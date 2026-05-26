import { prisma } from "@/lib/prisma";
import { AvitoApiError, explainAvitoError } from "@/lib/avito/client";
import { createAvitoClient } from "@/lib/avito/factory";
import { getCatalogFields } from "@/lib/avito/catalog";
import { getRawAvitoSettings, upsertAvitoSettings } from "@/lib/settings";
import { validateProductForApi } from "@/lib/product-validation";
import { defaultFeedUrl, parseJsonList } from "@/lib/serializers";

class ManualAutoloadStop extends Error {}

export async function submitProductToAutoload(productId: string) {
  const product = await prisma.productTemplate.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      photos: true,
      colorGroups: true,
    },
  });
  if (!product) return { status: 404, body: { error: "Product not found" } };

  const catalog = product.avitoCategorySlug ? await getCatalogFields(product.avitoCategorySlug) : { data: [] };
  const errors = validateProductForApi(product, catalog.data);
  const warnings: string[] = [];
  const events: string[] = [];
  const settings = await getRawAvitoSettings();
  let rawReport: unknown = null;
  let runStatus = errors.length ? "ERROR" : "SUBMITTED";
  let reportStatus = errors.length ? "local_validation_failed" : "autoload_ready";

  if (!settings.clientId || !settings.clientSecret) {
    warnings.push("Avito API keys are not configured. Product is ready locally and will sync after settings are filled.");
    runStatus = errors.length ? "ERROR" : "READY_FOR_API";
    reportStatus = errors.length ? reportStatus : "missing_credentials";
  } else if (!errors.length) {
    const client = createAvitoClient(settings);
    try {
      const feedUrl = settings.publicFeedUrl || defaultFeedUrl();
      const reportEmail = settings.autoloadReportEmail || settings.email || "supportautoload@avito.ru";
      const schedule = parseSchedule(settings.autoloadScheduleJson);
      let profileSynced = false;
      let uploadStarted = false;

      try {
        await client.syncAutoloadProfile({
          feedUrl,
          reportEmail,
          schedule,
          enabled: true,
        });
        profileSynced = true;
        events.push("Autoload profile synced.");
      } catch (profileError) {
        if (!isCapabilityUnavailable(profileError)) throw profileError;
        const message = manualAutoloadProfileMessage(feedUrl, profileError);
        warnings.push(message);
        reportStatus = "autoload_profile_manual_setup_required";
        await recordAutomationEvent("autoload_profile", "WARNING", message, { productId, feedUrl });
      }

      try {
        await client.triggerAutoloadUpload();
        uploadStarted = true;
        events.push("Autoload upload started.");
      } catch (uploadError) {
        const message = readableAvitoError(uploadError);
        warnings.push(message);
        if (profileSynced) {
          warnings.push("Профиль Autoload сохранен, но принудительный запуск upload недоступен. Avito сможет забрать фид по расписанию, если Autoload включен в кабинете.");
          reportStatus = isCapabilityUnavailable(uploadError) ? "profile_synced_upload_unavailable" : "profile_synced_upload_error";
        } else {
          warnings.push(manualAutoloadUploadMessage(feedUrl));
          runStatus = "READY_FOR_API";
          reportStatus = isCapabilityUnavailable(uploadError) ? "api_capability_unavailable" : "api_error";
          await recordAutomationEvent("autoload_submit", "WARNING", message, { productId, status: reportStatus });
          throw new ManualAutoloadStop();
        }
      }

      if (uploadStarted) {
        rawReport = await client.getAutoloadLastReport().catch(() => null);
        if (rawReport) {
          reportStatus = extractReportStatus(rawReport) || "upload_started";
          const reportMessages = extractReportMessages(rawReport);
          warnings.push(...reportMessages.warnings);
          errors.push(...reportMessages.errors);
        } else {
          reportStatus = "upload_started_report_pending";
        }
      }

      runStatus = errors.length ? "ERROR" : warnings.length ? "WARNING" : "SUBMITTED";
    } catch (error) {
      if (error instanceof ManualAutoloadStop) {
        // Warnings already explain the manual Autoload setup path.
      } else {
        const message = readableAvitoError(error);
        warnings.push(message);
        runStatus = "READY_FOR_API";
        reportStatus = error instanceof AvitoApiError && [403, 404].includes(error.status) ? "api_capability_unavailable" : "api_error";
        await recordAutomationEvent("autoload_submit", "WARNING", message, { productId, status: reportStatus });
      }
    }
  }

  const run = await prisma.publicationRun.create({
    data: {
      productId,
      feedVersion: new Date().toISOString().replace(/\D/g, "").slice(0, 14),
      status: runStatus,
      reportStatus,
      errorsJson: JSON.stringify([...new Set(errors)]),
      warningsJson: JSON.stringify([...new Set([...warnings, ...events])]),
      rawReport: rawReport ? JSON.stringify(rawReport) : null,
    },
  });

  if (!errors.length) {
    await prisma.productVariant.updateMany({
      where: { productId, stockQty: { gt: 0 }, publicationStatus: { not: "SUSPENDED" } },
      data: {
        publicationStatus: runStatus === "READY_FOR_API" ? "READY" : "SUBMITTED",
        needsSync: runStatus === "READY_FOR_API",
        ...(runStatus !== "READY_FOR_API" ? { lastPriceSyncAt: new Date(), lastStockSyncAt: new Date() } : {}),
      },
    });
    await prisma.productTemplate.update({
      where: { id: productId },
      data: {
        status: runStatus,
        publicationErrorsJson: JSON.stringify([...new Set(errors)]),
        lastApiSyncAt: new Date(),
      },
    });
  } else {
    await prisma.productTemplate.update({
      where: { id: productId },
      data: {
        status: "ERROR",
        publicationErrorsJson: JSON.stringify([...new Set(errors)]),
      },
    });
  }

  await recordAutomationEvent("autoload_submit", runStatus, reportStatus, { productId, runId: run.id });

  return {
    status: 200,
    body: {
      run,
      errors: [...new Set(errors)],
      warnings: [...new Set([...warnings, ...events])],
      status: runStatus,
      reportStatus,
    },
  };
}

export async function syncAutoloadProfile() {
  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return { ok: false, message: "Заполните Client ID и Client Secret." };
  }
  const client = createAvitoClient(settings);
  try {
    const payload = await client.syncAutoloadProfile({
      feedUrl: settings.publicFeedUrl || defaultFeedUrl(),
      reportEmail: settings.autoloadReportEmail || settings.email || "supportautoload@avito.ru",
      schedule: parseSchedule(settings.autoloadScheduleJson),
      enabled: true,
    });
    await recordAutomationEvent("autoload_profile", "OK", "Autoload profile synced.", payload);
    return { ok: true, payload };
  } catch (error) {
    const feedUrl = settings.publicFeedUrl || defaultFeedUrl();
    const message = isCapabilityUnavailable(error) ? manualAutoloadProfileMessage(feedUrl, error) : readableAvitoError(error);
    await recordAutomationEvent("autoload_profile", "ERROR", message);
    return { ok: false, status: isCapabilityUnavailable(error) ? "autoload_profile_manual_setup_required" : "api_error", message, feedUrl };
  }
}

export async function triggerAutoloadUpload() {
  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return { ok: false, message: "Заполните Client ID и Client Secret." };
  }
  const client = createAvitoClient(settings);
  try {
    const payload = await client.triggerAutoloadUpload();
    await recordAutomationEvent("autoload_upload", "OK", "Autoload upload started.", payload);
    return { ok: true, payload };
  } catch (error) {
    const message = readableAvitoError(error);
    await recordAutomationEvent("autoload_upload", "ERROR", message);
    return { ok: false, message };
  }
}

export async function syncAutoloadReports() {
  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return { ok: false, message: "Заполните Client ID и Client Secret." };
  }

  const client = createAvitoClient(settings);
  try {
    const payload = await client.getAutoloadReports({ per_page: 20, page: 0 });
    const reports = extractReports(payload);
    const latest = reports[0];
    const status = latest ? extractReportStatus(latest) || "reports_synced" : "reports_empty";
    await prisma.automationState.upsert({
      where: { id: "default" },
      create: { id: "default", status: "REPORTS_SYNCED", lastReportsSyncAt: new Date() },
      update: { status: "REPORTS_SYNCED", lastReportsSyncAt: new Date(), lastError: null },
    });
    await recordAutomationEvent("autoload_reports", "OK", status, payload);
    return { ok: true, reports, payload };
  } catch (error) {
    const message = readableAvitoError(error);
    await prisma.automationState.upsert({
      where: { id: "default" },
      create: { id: "default", status: "REPORTS_ERROR", lastError: message },
      update: { status: "REPORTS_ERROR", lastError: message },
    });
    await recordAutomationEvent("autoload_reports", "ERROR", message);
    return { ok: false, message, reports: [] };
  }
}

export async function saveCapabilities(capabilities: Record<string, unknown>) {
  await upsertAvitoSettings({ capabilitiesJson: JSON.stringify(capabilities) });
}

export async function recordAutomationEvent(task: string, status: string, message?: string, payload?: unknown) {
  await prisma.automationEvent.create({
    data: {
      task,
      status,
      message,
      payloadJson: JSON.stringify(payload ?? {}),
    },
  });
}

function readableAvitoError(error: unknown): string {
  if (error instanceof AvitoApiError) return explainAvitoError(error);
  return error instanceof Error ? error.message : "Unknown Avito API error";
}

function isCapabilityUnavailable(error: unknown) {
  return error instanceof AvitoApiError && [0, 403, 404].includes(error.status);
}

function manualAutoloadProfileMessage(feedUrl: string, error: unknown) {
  return [
    "Avito не дал приложению доступ к управлению профилем Autoload через API.",
    "Это не ошибка товара: ключи работают, но этот метод закрыт для приложения, аккаунта или тарифа.",
    `Что сделать: откройте в кабинете Avito раздел Автозагрузка и вручную укажите feed URL ${feedUrl}.`,
    "После ручной настройки SEB0G1SHOPCHIK продолжит готовить товары, фид и отчеты по доступным API.",
    `Деталь Avito: ${readableAvitoError(error)}`,
  ].join(" ");
}

function manualAutoloadUploadMessage(feedUrl: string) {
  return [
    "Принудительный запуск Autoload upload через API тоже недоступен.",
    `Товар и XML-фид готовы, но для публикации нужно включить автозагрузку в кабинете Avito и указать feed URL ${feedUrl}.`,
    "Если Avito выдаст доступ к Autoload upload/profile позже, эта же кнопка начнет отправлять товар автоматически.",
  ].join(" ");
}

function parseSchedule(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractReports(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["reports", "items", "data", "result"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function extractReportStatus(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  return String(record.status ?? record.report_status ?? record.reportStatus ?? "");
}

function extractReportMessages(payload: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  walk(payload, (item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const type = String(record.type ?? "").toLowerCase();
    const text = String(record.title ?? record.description ?? record.message ?? "");
    if (!text) return;
    if (type === "error") errors.push(text);
    if (type === "warning" || type === "alarm") warnings.push(text);
  });
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function walk(value: unknown, visitor: (value: unknown) => void) {
  visitor(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => walk(item, visitor));
  }
}
