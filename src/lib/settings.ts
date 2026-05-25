import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { defaultFeedUrl, defaultRedirectUrl, toClientSettings } from "@/lib/serializers";

export async function getAvitoSettings() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  return toClientSettings(settings);
}

export async function getRawAvitoSettings() {
  const settings = await prisma.avitoSettings.findUnique({ where: { id: "default" } });
  return {
    clientId: settings?.clientId ?? "",
    clientSecret: decryptSecret(settings?.clientSecretEncrypted),
    sellerLocation: settings?.sellerLocation ?? "Москва",
    contactName: settings?.contactName ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    address: settings?.address ?? "Москва",
    publicFeedUrl: settings?.publicFeedUrl ?? defaultFeedUrl(),
    redirectUrl: settings?.redirectUrl ?? defaultRedirectUrl(),
  };
}

export async function upsertAvitoSettings(input: {
  clientId?: string;
  clientSecret?: string;
  sellerLocation?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  publicFeedUrl?: string;
  redirectUrl?: string;
}) {
  const data = {
    clientId: input.clientId?.trim() || null,
    ...(input.clientSecret
      ? { clientSecretEncrypted: encryptSecret(input.clientSecret.trim()) }
      : {}),
    sellerLocation: input.sellerLocation?.trim() || "Москва",
    contactName: input.contactName?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || "Москва",
    publicFeedUrl: input.publicFeedUrl?.trim() || null,
    redirectUrl: input.redirectUrl?.trim() || process.env.AVITO_REDIRECT_URL || null,
  };

  const settings = await prisma.avitoSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  return toClientSettings(settings);
}
