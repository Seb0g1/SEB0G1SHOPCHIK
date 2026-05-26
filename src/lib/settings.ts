import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { defaultFeedUrl, defaultRedirectUrl, toClientSettings } from "@/lib/serializers";

const defaultCity = "Москва";

export async function getAvitoSettings() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  return toClientSettingsWithSecretStatus(settings);
}

export async function getRawAvitoSettings() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  const decryptedSecret = decryptSecret(settings?.clientSecretEncrypted);
  return {
    clientId: settings?.clientId ?? process.env.AVITO_CLIENT_ID ?? "",
    clientSecret: decryptedSecret ?? process.env.AVITO_CLIENT_SECRET ?? "",
    accessToken: decryptSecret(settings?.accessTokenEncrypted),
    refreshToken: decryptSecret(settings?.refreshTokenEncrypted),
    tokenExpiresAt: settings?.tokenExpiresAt ?? null,
    avitoUserId: settings?.avitoUserId ?? process.env.AVITO_ACCOUNT_ID ?? "self",
    sellerLocation: settings?.sellerLocation ?? defaultCity,
    contactName: settings?.contactName ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    address: settings?.address ?? defaultCity,
    publicFeedUrl: settings?.publicFeedUrl ?? defaultFeedUrl(),
    redirectUrl: settings?.redirectUrl ?? defaultRedirectUrl(),
    autoloadReportEmail: settings?.autoloadReportEmail ?? settings?.email ?? "",
    autoloadScheduleJson: settings?.autoloadScheduleJson ?? "[]",
    capabilitiesJson: settings?.capabilitiesJson ?? "{}",
  };
}

export async function saveAvitoOAuthTokens(input: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
}) {
  const expiresAt = new Date(Date.now() + Math.max(60, input.expiresIn ?? 3600) * 1000);
  await prisma.avitoSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      accessTokenEncrypted: encryptSecret(input.accessToken),
      refreshTokenEncrypted: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      tokenExpiresAt: expiresAt,
    },
    update: {
      accessTokenEncrypted: encryptSecret(input.accessToken),
      ...(input.refreshToken ? { refreshTokenEncrypted: encryptSecret(input.refreshToken) } : {}),
      tokenExpiresAt: expiresAt,
    },
  });
}

export async function upsertAvitoSettings(input: {
  clientId?: string;
  clientSecret?: string;
  avitoUserId?: string;
  sellerLocation?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  publicFeedUrl?: string;
  redirectUrl?: string;
  autoloadReportEmail?: string;
  autoloadScheduleJson?: string;
  capabilitiesJson?: string;
}) {
  const trimmedSecret = input.clientSecret?.trim();
  const data = {
    clientId: input.clientId?.trim() || process.env.AVITO_CLIENT_ID || null,
    avitoUserId: input.avitoUserId?.trim() || process.env.AVITO_ACCOUNT_ID || "self",
    ...(trimmedSecret ? { clientSecretEncrypted: encryptSecret(trimmedSecret) } : {}),
    sellerLocation: input.sellerLocation?.trim() || defaultCity,
    contactName: input.contactName?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || defaultCity,
    publicFeedUrl: input.publicFeedUrl?.trim() || null,
    redirectUrl: input.redirectUrl?.trim() || process.env.AVITO_REDIRECT_URL || null,
    autoloadReportEmail: input.autoloadReportEmail?.trim() || input.email?.trim() || null,
    autoloadScheduleJson: input.autoloadScheduleJson?.trim() || "[]",
    ...(input.capabilitiesJson !== undefined ? { capabilitiesJson: input.capabilitiesJson } : {}),
  };

  const settings = await prisma.avitoSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  return toClientSettingsWithSecretStatus(settings);
}

export async function getAvitoCredentialStatus() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  const encrypted = settings?.clientSecretEncrypted ?? "";
  const decrypted = decryptSecret(encrypted);
  const clientId = settings?.clientId?.trim() || process.env.AVITO_CLIENT_ID || "";
  const envSecret = process.env.AVITO_CLIENT_SECRET || "";
  const clientSecret = decrypted || envSecret;

  return {
    clientId,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    secretStatus: getSecretStatus(encrypted, decrypted, envSecret),
  };
}

export function explainAvitoCredentialStatus(status: Awaited<ReturnType<typeof getAvitoCredentialStatus>>) {
  if (!status.hasClientId) return "Заполните Client ID.";
  if (status.secretStatus === "invalid") {
    return "Client secret сохранен, но не расшифровывается текущим SETTINGS_ENCRYPTION_KEY. Вставьте Client secret заново и сохраните настройки.";
  }
  if (!status.hasClientSecret) return "Заполните Client Secret.";
  return "";
}

function toClientSettingsWithSecretStatus(settings: Parameters<typeof toClientSettings>[0]) {
  const encrypted = settings?.clientSecretEncrypted ?? "";
  const decrypted = decryptSecret(encrypted);
  const envSecret = process.env.AVITO_CLIENT_SECRET || "";
  const client = toClientSettings(settings);
  const secretStatus = getSecretStatus(encrypted, decrypted, envSecret);
  const secretSource: ReturnType<typeof toClientSettings>["secretSource"] =
    secretStatus === "ok" ? "database" : secretStatus;

  return {
    ...client,
    clientId: client.clientId || process.env.AVITO_CLIENT_ID || "",
    hasClientSecret: secretStatus === "ok" || secretStatus === "env",
    secretStatus,
    secretSource,
  };
}

function getSecretStatus(encrypted: string | null | undefined, decrypted: string | null | undefined, envSecret: string) {
  if (decrypted) return "ok" as const;
  if (envSecret) return "env" as const;
  if (encrypted) return "invalid" as const;
  return "empty" as const;
}
