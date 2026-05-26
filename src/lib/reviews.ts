import { prisma } from "@/lib/prisma";
import { getRawAvitoSettings } from "@/lib/settings";
import { AvitoApiError, AvitoClient, explainAvitoError } from "@/lib/avito/client";
import {
  DEFAULT_REPLY_TEMPLATES,
  normalizeAvitoReplyText,
  renderReplyTemplate,
  selectReplyTemplate,
  type ReplyTemplateRule,
  type ReviewForTemplate,
} from "@/lib/review-templates";

type JsonObject = Record<string, unknown>;

type ReviewRecord = {
  id: string;
  avitoReviewId: string;
  rating: number;
  text: string;
  authorName: string | null;
  itemId: string | null;
  itemTitle: string | null;
  status: string;
  rawJson: string;
  avitoCreatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  replyDraft?: DraftRecord | null;
};

type DraftRecord = {
  id: string;
  reviewId: string;
  templateId: string | null;
  text: string;
  status: string;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  template?: TemplateRecord | null;
};

type TemplateRecord = {
  id: string;
  name: string;
  ratingMin: number;
  ratingMax: number;
  keywords: string;
  text: string;
  priority: number;
  active: boolean;
  autoSend: boolean;
  kind: string;
  createdAt: Date;
  updatedAt: Date;
};

type AutomationRecord = {
  id: string;
  onlineEnabled: boolean;
  reviewsEnabled: boolean;
  draftsEnabled: boolean;
  reviewAutoSendEnabled: boolean;
  messagesEnabled: boolean;
  messageAutoRepliesEnabled: boolean;
  reportsEnabled: boolean;
  ordersEnabled: boolean;
  status: string;
  lastOnlinePingAt: Date | null;
  lastReviewsSyncAt: Date | null;
  lastReviewAutoSendAt: Date | null;
  lastMessagesSyncAt: Date | null;
  lastMessageRulesAt: Date | null;
  lastReportsSyncAt: Date | null;
  lastOrdersSyncAt: Date | null;
  lastError: string | null;
  capabilitiesJson: string;
  updatedAt: Date;
};

export async function ensureDefaultTemplates() {
  for (const template of DEFAULT_REPLY_TEMPLATES) {
    await prisma.replyTemplate.upsert({
      where: { id: template.id || template.name },
      create: {
        id: template.id,
        name: template.name,
        ratingMin: template.ratingMin,
        ratingMax: template.ratingMax,
        keywords: template.keywords,
        text: template.text,
        priority: template.priority,
        active: template.active,
        autoSend: false,
        kind: "REVIEW",
      },
      update: {},
    });
  }
}

export async function getAutomationState() {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return toClientAutomationState(state);
}

export async function updateAutomationState(input: {
  onlineEnabled?: boolean;
  reviewsEnabled?: boolean;
  draftsEnabled?: boolean;
  reviewAutoSendEnabled?: boolean;
  messagesEnabled?: boolean;
  messageAutoRepliesEnabled?: boolean;
  reportsEnabled?: boolean;
  ordersEnabled?: boolean;
}) {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      onlineEnabled: Boolean(input.onlineEnabled),
      reviewsEnabled: input.reviewsEnabled ?? true,
      draftsEnabled: input.draftsEnabled ?? true,
      reviewAutoSendEnabled: input.reviewAutoSendEnabled ?? true,
      messagesEnabled: input.messagesEnabled ?? false,
      messageAutoRepliesEnabled: input.messageAutoRepliesEnabled ?? false,
      reportsEnabled: input.reportsEnabled ?? true,
      ordersEnabled: input.ordersEnabled ?? true,
    },
    update: {
      ...(input.onlineEnabled !== undefined ? { onlineEnabled: input.onlineEnabled } : {}),
      ...(input.reviewsEnabled !== undefined ? { reviewsEnabled: input.reviewsEnabled } : {}),
      ...(input.draftsEnabled !== undefined ? { draftsEnabled: input.draftsEnabled } : {}),
      ...(input.reviewAutoSendEnabled !== undefined ? { reviewAutoSendEnabled: input.reviewAutoSendEnabled } : {}),
      ...(input.messagesEnabled !== undefined ? { messagesEnabled: input.messagesEnabled } : {}),
      ...(input.messageAutoRepliesEnabled !== undefined ? { messageAutoRepliesEnabled: input.messageAutoRepliesEnabled } : {}),
      ...(input.reportsEnabled !== undefined ? { reportsEnabled: input.reportsEnabled } : {}),
      ...(input.ordersEnabled !== undefined ? { ordersEnabled: input.ordersEnabled } : {}),
    },
  });
  return toClientAutomationState(state);
}

export async function probeAutomationCapabilities() {
  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    const capabilities = {
      profile: { available: false, status: "missing_credentials", message: "Заполните Client ID и Client Secret." },
      reviews: { available: false, status: "missing_credentials", message: "Заполните Client ID и Client Secret." },
      reviewReplies: { available: false, status: "missing_credentials", message: "Заполните Client ID и Client Secret." },
      onlinePresence: { available: false, status: "missing_credentials", message: "Заполните Client ID и Client Secret." },
      orders: { available: false, status: "missing_credentials", message: "Заполните Client ID и Client Secret." },
    };
    const state = await prisma.automationState.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        status: "NEEDS_SETTINGS",
        lastError: "Avito API credentials не заполнены.",
        capabilitiesJson: JSON.stringify(capabilities),
      },
      update: {
        status: "NEEDS_SETTINGS",
        lastError: "Avito API credentials не заполнены.",
        capabilitiesJson: JSON.stringify(capabilities),
      },
    });
    return toClientAutomationState(state);
  }

  const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });
  const capabilities = await client.probeCapabilities();
  const onlineUnavailable = capabilities.onlinePresence?.available === false;

  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      status: "CAPABILITIES_PROBED",
      onlineEnabled: !onlineUnavailable,
      capabilitiesJson: JSON.stringify(capabilities),
      lastError: onlineUnavailable ? capabilities.onlinePresence?.message ?? null : null,
    },
    update: {
      status: "CAPABILITIES_PROBED",
      ...(onlineUnavailable ? { onlineEnabled: false } : {}),
      capabilitiesJson: JSON.stringify(capabilities),
      lastError: onlineUnavailable ? capabilities.onlinePresence?.message ?? null : null,
    },
  });

  return toClientAutomationState(state);
}

export async function runOnlinePing(options: { force?: boolean } = {}) {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  if (!state.onlineEnabled && !options.force) {
    return {
      ok: false,
      skipped: true,
      state: toClientAutomationState(state),
      message: "Поддержание онлайн выключено.",
    };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    const updated = await markAutomationError("Avito API credentials не заполнены.", "NEEDS_SETTINGS", {
      onlineEnabled: false,
    });
    return { ok: false, state: updated, message: "Заполните Client ID и Client Secret." };
  }

  const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });

  try {
    const payload = await client.setOnlinePresence();
    const updated = await prisma.automationState.update({
      where: { id: "default" },
      data: {
        onlineEnabled: true,
        status: "ONLINE_OK",
        lastOnlinePingAt: new Date(),
        lastError: null,
      },
    });
    return { ok: true, state: toClientAutomationState(updated), payload };
  } catch (error) {
    const message = readableAvitoError(error);
    const unavailable = error instanceof AvitoApiError && [0, 403, 404].includes(error.status);
    const updated = await markAutomationError(message, unavailable ? "ONLINE_UNAVAILABLE" : "ONLINE_ERROR", {
      ...(unavailable ? { onlineEnabled: false } : {}),
    });
    return { ok: false, state: updated, message };
  }
}

export async function syncReviews(options: { force?: boolean } = {}) {
  await ensureDefaultTemplates();

  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  if (!state.reviewsEnabled && !options.force) {
    return {
      ok: false,
      skipped: true,
      state: toClientAutomationState(state),
      synced: 0,
      drafts: 0,
      message: "Синхронизация отзывов выключена.",
    };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    const updated = await markAutomationError("Avito API credentials не заполнены.", "NEEDS_SETTINGS");
    return { ok: false, state: updated, synced: 0, drafts: 0, message: "Заполните Client ID и Client Secret." };
  }

  const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });

  try {
    const payload = await client.getReviews({ limit: 50 });
    const normalized = extractReviews(payload);
    const upserted = [];
    for (const item of normalized) {
      const review = normalizeReviewPayload(item);
      if (!review) continue;
      upserted.push(await upsertReview(review));
    }

    let draftCount = 0;
    let autoSentCount = 0;
    if (state.draftsEnabled) {
      for (const review of upserted) {
        const draft = await ensureDraftForReview(review.id);
        if (draft?.created) draftCount += 1;
        if (state.reviewAutoSendEnabled && draft?.draft.templateId) {
          const template = await prisma.replyTemplate.findUnique({ where: { id: draft.draft.templateId } });
          if (template?.active && template.autoSend && draft.draft.status === "DRAFT" && draft.draft.text.trim()) {
            const sent = await sendReviewReply(review.id, draft.draft.text);
            if (sent.ok) autoSentCount += 1;
          }
        }
      }
    }

    const updated = await prisma.automationState.update({
      where: { id: "default" },
      data: {
        status: "REVIEWS_SYNCED",
        lastReviewsSyncAt: new Date(),
        ...(autoSentCount > 0 ? { lastReviewAutoSendAt: new Date() } : {}),
        lastError: null,
      },
    });

    return {
      ok: true,
      state: toClientAutomationState(updated),
      synced: upserted.length,
      drafts: draftCount,
      autoSent: autoSentCount,
      payload,
    };
  } catch (error) {
    const message = readableAvitoError(error);
    const updated = await markAutomationError(message, "REVIEWS_ERROR");
    return { ok: false, state: updated, synced: 0, drafts: 0, message };
  }
}

export async function listReviews(filters: { status?: string; rating?: number; replied?: string } = {}) {
  const reviews = await prisma.review.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.rating ? { rating: filters.rating } : {}),
      ...(filters.replied === "draft" ? { replyDraft: { is: { status: "DRAFT" } } } : {}),
      ...(filters.replied === "sent" ? { replyDraft: { is: { status: "SENT" } } } : {}),
      ...(filters.replied === "none" ? { replyDraft: { is: null } } : {}),
    },
    include: { replyDraft: { include: { template: true } } },
    orderBy: [{ avitoCreatedAt: "desc" }, { createdAt: "desc" }],
  });
  return reviews.map(toClientReview);
}

export async function getReviewById(id: string) {
  const review = await prisma.review.findUnique({
    where: { id },
    include: { replyDraft: { include: { template: true } } },
  });
  return review ? toClientReview(review) : null;
}

export async function ensureDraftForReview(reviewId: string, options: { regenerate?: boolean } = {}) {
  await ensureDefaultTemplates();
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { replyDraft: true },
  });
  if (!review) return null;
  if (review.replyDraft && !options.regenerate) {
    return { created: false, draft: toClientDraft(review.replyDraft) };
  }
  if (review.replyDraft?.status === "SENT") {
    return { created: false, draft: toClientDraft(review.replyDraft) };
  }

  const templates = await prisma.replyTemplate.findMany({ where: { active: true, kind: "REVIEW" } });
  const matched = selectReplyTemplate(toTemplateReview(review), templates.map(templateToRule));
  if (!matched) return null;

  const text = renderReplyTemplate(matched.text, toTemplateReview(review), {
    shopName: "SEB0G1SHOPCHIK",
  });

  const draft = await prisma.reviewReplyDraft.upsert({
    where: { reviewId: review.id },
    create: {
      reviewId: review.id,
      templateId: matched.id,
      text,
      status: "DRAFT",
    },
    update: {
      templateId: matched.id,
      text,
      status: "DRAFT",
      error: null,
    },
  });

  return { created: !review.replyDraft, draft: toClientDraft(draft) };
}

export async function saveReviewDraft(reviewId: string, input: { text: string; templateId?: string | null }) {
  const text = normalizeAvitoReplyText(input.text);
  const draft = await prisma.reviewReplyDraft.upsert({
    where: { reviewId },
    create: {
      reviewId,
      templateId: input.templateId ?? null,
      text,
      status: "DRAFT",
    },
    update: {
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      text,
      status: "DRAFT",
      error: null,
    },
  });
  return toClientDraft(draft);
}

export async function sendReviewReply(reviewId: string, text?: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { replyDraft: true } });
  if (!review) return { ok: false, message: "Отзыв не найден." };

  const draft = text
    ? await prisma.reviewReplyDraft.upsert({
        where: { reviewId },
        create: { reviewId, text: normalizeAvitoReplyText(text), status: "DRAFT" },
        update: { text: normalizeAvitoReplyText(text), status: "DRAFT", error: null },
      })
    : review.replyDraft ?? (await ensureDraftForReview(reviewId))?.draft;

  if (!draft) {
    return { ok: false, message: "Нет черновика ответа." };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    const failed = await prisma.reviewReplyDraft.update({
      where: { reviewId },
      data: { status: "FAILED", error: "Avito API credentials не заполнены." },
    });
    return { ok: false, draft: toClientDraft(failed), message: "Заполните Client ID и Client Secret." };
  }

  const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });

  try {
    const payload = await client.sendReviewReply(review.avitoReviewId, draft.text);
    const sent = await prisma.reviewReplyDraft.update({
      where: { reviewId },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
    return { ok: true, draft: toClientDraft(sent), payload };
  } catch (error) {
    const message = readableAvitoError(error);
    const failed = await prisma.reviewReplyDraft.update({
      where: { reviewId },
      data: { status: "FAILED", error: message },
    });
    return { ok: false, draft: toClientDraft(failed), message };
  }
}

export async function listTemplates() {
  await ensureDefaultTemplates();
  const templates = await prisma.replyTemplate.findMany({ orderBy: [{ kind: "asc" }, { active: "desc" }, { priority: "desc" }] });
  return templates.map(toClientTemplate);
}

export async function createTemplate(input: {
  name: string;
  ratingMin: number;
  ratingMax: number;
  keywords?: string;
  text: string;
  priority?: number;
  active?: boolean;
  autoSend?: boolean;
  kind?: string;
}) {
  const template = await prisma.replyTemplate.create({
    data: {
      name: input.name.trim(),
      ratingMin: input.ratingMin,
      ratingMax: input.ratingMax,
      keywords: input.keywords?.trim() ?? "",
      text: normalizeAvitoReplyText(input.text),
      priority: input.priority ?? 0,
      active: input.active ?? true,
      autoSend: input.autoSend ?? false,
      kind: input.kind ?? "REVIEW",
    },
  });
  return toClientTemplate(template);
}

export async function updateTemplate(
  id: string,
  input: Partial<{
    name: string;
    ratingMin: number;
    ratingMax: number;
    keywords: string;
    text: string;
    priority: number;
    active: boolean;
    autoSend: boolean;
    kind: string;
  }>,
) {
  const template = await prisma.replyTemplate.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.ratingMin !== undefined ? { ratingMin: input.ratingMin } : {}),
      ...(input.ratingMax !== undefined ? { ratingMax: input.ratingMax } : {}),
      ...(input.keywords !== undefined ? { keywords: input.keywords.trim() } : {}),
      ...(input.text !== undefined ? { text: normalizeAvitoReplyText(input.text) } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.autoSend !== undefined ? { autoSend: input.autoSend } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
    },
  });
  return toClientTemplate(template);
}

export async function deleteTemplate(id: string) {
  await prisma.replyTemplate.delete({ where: { id } });
  return { ok: true };
}

function extractReviews(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [];
  for (const key of ["reviews", "items", "data", "result", "results"]) {
    const value = payload[key];
    const nested = extractReviews(value);
    if (nested.length > 0) return nested;
  }
  return [];
}

function normalizeReviewPayload(payload: unknown) {
  if (!isObject(payload)) return null;
  const avitoReviewId = getString(payload, ["id", "review_id", "reviewId", "uuid"]);
  if (!avitoReviewId) return null;

  const rating = getNumber(payload, ["rating", "score", "stars"]) ?? 0;
  return {
    avitoReviewId,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    text: getString(payload, ["text", "comment", "review_text", "message"]) || "",
    authorName:
      getString(payload, ["author_name", "authorName", "name"]) ||
      getNestedString(payload, ["author", "name"]) ||
      getNestedString(payload, ["user", "name"]) ||
      null,
    itemId:
      getString(payload, ["item_id", "itemId", "ad_id", "adId"]) ||
      getNestedString(payload, ["item", "id"]) ||
      getNestedString(payload, ["ad", "id"]) ||
      null,
    itemTitle:
      getString(payload, ["item_title", "itemTitle", "ad_title", "adTitle"]) ||
      getNestedString(payload, ["item", "title"]) ||
      getNestedString(payload, ["ad", "title"]) ||
      null,
    status: getString(payload, ["status", "state"]) || "NEW",
    avitoCreatedAt: getDate(payload, ["created_at", "createdAt", "date", "published_at"]),
    rawJson: JSON.stringify(payload),
  };
}

async function upsertReview(review: NonNullable<ReturnType<typeof normalizeReviewPayload>>) {
  return prisma.review.upsert({
    where: { avitoReviewId: review.avitoReviewId },
    create: review,
    update: {
      rating: review.rating,
      text: review.text,
      authorName: review.authorName,
      itemId: review.itemId,
      itemTitle: review.itemTitle,
      status: review.status,
      avitoCreatedAt: review.avitoCreatedAt,
      rawJson: review.rawJson,
    },
  });
}

async function markAutomationError(
  message: string,
  status: string,
  data: Partial<{ onlineEnabled: boolean; reviewsEnabled: boolean; draftsEnabled: boolean }> = {},
) {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      status,
      lastError: message,
      ...data,
    },
    update: {
      status,
      lastError: message,
      ...data,
    },
  });
  return toClientAutomationState(state);
}

function readableAvitoError(error: unknown): string {
  if (error instanceof AvitoApiError) return explainAvitoError(error);
  return error instanceof Error ? error.message : "Unknown Avito API error";
}

function toTemplateReview(review: ReviewForTemplate & { authorName?: string | null }): ReviewForTemplate {
  return {
    rating: review.rating,
    text: review.text,
    authorName: review.authorName,
    itemTitle: review.itemTitle,
  };
}

function templateToRule(template: TemplateRecord): ReplyTemplateRule {
  return {
    id: template.id,
    name: template.name,
    ratingMin: template.ratingMin,
    ratingMax: template.ratingMax,
    keywords: template.keywords,
    text: template.text,
    priority: template.priority,
    active: template.active,
  };
}

function toClientReview(review: ReviewRecord) {
  return {
    id: review.id,
    avitoReviewId: review.avitoReviewId,
    rating: review.rating,
    text: review.text,
    authorName: review.authorName,
    itemId: review.itemId,
    itemTitle: review.itemTitle,
    status: review.status,
    avitoCreatedAt: review.avitoCreatedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    replyDraft: review.replyDraft ? toClientDraft(review.replyDraft) : null,
  };
}

function toClientDraft(draft: DraftRecord) {
  return {
    id: draft.id,
    reviewId: draft.reviewId,
    templateId: draft.templateId,
    text: draft.text,
    status: draft.status,
    sentAt: draft.sentAt?.toISOString() ?? null,
    error: draft.error,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    template: draft.template ? toClientTemplate(draft.template) : null,
  };
}

function toClientTemplate(template: TemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    ratingMin: template.ratingMin,
    ratingMax: template.ratingMax,
    keywords: template.keywords,
    text: template.text,
    priority: template.priority,
    active: template.active,
    autoSend: template.autoSend,
    kind: template.kind,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toClientAutomationState(state: AutomationRecord) {
  return {
    id: state.id,
    onlineEnabled: state.onlineEnabled,
    reviewsEnabled: state.reviewsEnabled,
    draftsEnabled: state.draftsEnabled,
    reviewAutoSendEnabled: state.reviewAutoSendEnabled,
    messagesEnabled: state.messagesEnabled,
    messageAutoRepliesEnabled: state.messageAutoRepliesEnabled,
    reportsEnabled: state.reportsEnabled,
    ordersEnabled: state.ordersEnabled,
    status: state.status,
    lastOnlinePingAt: state.lastOnlinePingAt?.toISOString() ?? null,
    lastReviewsSyncAt: state.lastReviewsSyncAt?.toISOString() ?? null,
    lastReviewAutoSendAt: state.lastReviewAutoSendAt?.toISOString() ?? null,
    lastMessagesSyncAt: state.lastMessagesSyncAt?.toISOString() ?? null,
    lastMessageRulesAt: state.lastMessageRulesAt?.toISOString() ?? null,
    lastReportsSyncAt: state.lastReportsSyncAt?.toISOString() ?? null,
    lastOrdersSyncAt: state.lastOrdersSyncAt?.toISOString() ?? null,
    lastError: state.lastError,
    capabilities: parseJsonObject(state.capabilitiesJson),
    updatedAt: state.updatedAt.toISOString(),
  };
}

function parseJsonObject(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function getNestedString(payload: JsonObject, path: string[]) {
  let value: unknown = payload;
  for (const key of path) {
    if (!isObject(value)) return "";
    value = value[key];
  }
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function getNumber(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function getDate(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}
