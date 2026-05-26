import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { defaultFeedUrl, defaultRedirectUrl, toClientSettings } from "@/lib/serializers";

const defaultCity = "Москва";

export async function getAvitoSettings() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  return toClientSettings(settings);
}

export async function getRawAvitoSettings() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  return {
    clientId: settings?.clientId ?? "",
    clientSecret: decryptSecret(settings?.clientSecretEncrypted),
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
  const data = {
    clientId: input.clientId?.trim() || null,
    avitoUserId: input.avitoUserId?.trim() || process.env.AVITO_ACCOUNT_ID || "self",
    ...(input.clientSecret ? { clientSecretEncrypted: encryptSecret(input.clientSecret.trim()) } : {}),
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

  return toClientSettings(settings);
}
