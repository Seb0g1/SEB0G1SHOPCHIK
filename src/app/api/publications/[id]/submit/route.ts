import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRawAvitoSettings } from "@/lib/settings";
import { AvitoClient } from "@/lib/avito/client";
import { getCatalogFields } from "@/lib/avito/catalog";
import { validateProductForApi } from "@/lib/product-validation";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await prisma.productTemplate.findUnique({
    where: { id },
    include: {
      variants: true,
      photos: true,
    },
  });

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const catalog = product.avitoCategorySlug ? await getCatalogFields(product.avitoCategorySlug) : { data: [] };
  const errors = validateProductForApi(product, catalog.data);
  const warnings: string[] = [];
  const settings = await getRawAvitoSettings();

  if (!settings.clientId || !settings.clientSecret) {
    warnings.push("Avito API-ключи еще не заполнены: отправка в Авито пропущена.");
  } else if (!errors.length) {
    try {
      const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });
      const result = await client.testConnection();
      warnings.push(`Avito API status: ${result.status}.`);
    } catch (error) {
      warnings.push(`Avito API не подтвердил подключение: ${error instanceof Error ? error.message : "unknown error"}.`);
    }
  }

  const status = errors.length ? "ERROR" : warnings.length ? "WARNING" : "SUBMITTED";
  const run = await prisma.publicationRun.create({
    data: {
      productId: id,
      feedVersion: new Date()
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replaceAll(".", "")
        .replaceAll("T", "")
        .replaceAll("Z", "")
        .slice(0, 14),
      status,
      reportStatus: status === "ERROR" ? "local_validation_failed" : "api_ready",
      errorsJson: JSON.stringify(errors),
      warningsJson: JSON.stringify(warnings),
    },
  });

  if (!errors.length) {
    await prisma.productVariant.updateMany({
      where: { productId: id, stockQty: { gt: 0 }, publicationStatus: { not: "SUSPENDED" } },
      data: { publicationStatus: "SUBMITTED" },
    });
    await prisma.productTemplate.update({
      where: { id },
      data: {
        status: warnings.length ? "WARNING" : "READY",
        publicationErrorsJson: "[]",
        lastApiSyncAt: new Date(),
      },
    });
  } else {
    await prisma.productTemplate.update({
      where: { id },
      data: {
        status: "ERROR",
        publicationErrorsJson: JSON.stringify(errors),
      },
    });
  }

  return NextResponse.json({ run, errors, warnings, status });
}
