import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolveDatabasePath(process.env.DATABASE_URL || readEnvDatabaseUrl() || "file:./../data/dev.db");
mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "ProductTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "brand" TEXT,
  "category" TEXT NOT NULL DEFAULT 'Личные вещи',
  "goodsType" TEXT NOT NULL DEFAULT 'Одежда, обувь, аксессуары',
  "productType" TEXT NOT NULL DEFAULT 'Футболки и топы',
  "adType" TEXT NOT NULL DEFAULT 'Товар приобретен на продажу',
  "gender" TEXT NOT NULL DEFAULT 'Мужская',
  "condition" TEXT NOT NULL DEFAULT 'Новое',
  "basePrice" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL DEFAULT '',
  "generatedDescription" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ProductVariant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "stockQty" INTEGER NOT NULL DEFAULT 1,
  "avitoExternalId" TEXT,
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PhotoAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "color" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "localPath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotoAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PublicationRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT,
  "feedVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reportStatus" TEXT,
  "errorsJson" TEXT NOT NULL DEFAULT '[]',
  "warningsJson" TEXT NOT NULL DEFAULT '[]',
  "rawReport" TEXT,
  CONSTRAINT "PublicationRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AvitoSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "clientId" TEXT,
  "clientSecretEncrypted" TEXT,
  "sellerLocation" TEXT,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "publicFeedUrl" TEXT,
  "redirectUrl" TEXT,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_color_idx" ON "ProductVariant"("productId", "color");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_productId_color_size_key" ON "ProductVariant"("productId", "color", "size");
CREATE INDEX IF NOT EXISTS "PhotoAsset_productId_color_idx" ON "PhotoAsset"("productId", "color");
`);

db.close();
console.log(`SQLite database ready: ${databasePath}`);

function resolveDatabasePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Only SQLite file: DATABASE_URL is supported by init-db.");
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(rawPath)) return rawPath;

  const schemaRelativeRoot = path.join(process.cwd(), "prisma");
  return path.resolve(schemaRelativeRoot, rawPath);
}

function readEnvDatabaseUrl() {
  try {
    const envFile = path.join(process.cwd(), ".env");
    const text = readFileSync(envFile, "utf8");
    const line = text
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith("DATABASE_URL="));
    if (!line) return null;
    return line
      .slice("DATABASE_URL=".length)
      .trim()
      .replace(/^"(.*)"$/, "$1");
  } catch {
    return null;
  }
}
