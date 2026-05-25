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
  "avitoCategorySlug" TEXT,
  "avitoCategoryName" TEXT,
  "avitoFieldsJson" TEXT NOT NULL DEFAULT '{}',
  "publicationErrorsJson" TEXT NOT NULL DEFAULT '[]',
  "lastApiSyncAt" DATETIME,
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

CREATE TABLE IF NOT EXISTS "AvitoCatalogCache" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "dataJson" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "avitoReviewId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "authorName" TEXT,
  "itemId" TEXT,
  "itemTitle" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "rawJson" TEXT NOT NULL DEFAULT '{}',
  "avitoCreatedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ReplyTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ratingMin" INTEGER NOT NULL DEFAULT 1,
  "ratingMax" INTEGER NOT NULL DEFAULT 5,
  "keywords" TEXT NOT NULL DEFAULT '',
  "text" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ReviewReplyDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reviewId" TEXT NOT NULL,
  "templateId" TEXT,
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sentAt" DATETIME,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReviewReplyDraft_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewReplyDraft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReplyTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AutomationState" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "onlineEnabled" BOOLEAN NOT NULL DEFAULT 0,
  "reviewsEnabled" BOOLEAN NOT NULL DEFAULT 1,
  "draftsEnabled" BOOLEAN NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "lastOnlinePingAt" DATETIME,
  "lastReviewsSyncAt" DATETIME,
  "lastError" TEXT,
  "capabilitiesJson" TEXT NOT NULL DEFAULT '{}',
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_color_idx" ON "ProductVariant"("productId", "color");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_productId_color_size_key" ON "ProductVariant"("productId", "color", "size");
CREATE INDEX IF NOT EXISTS "PhotoAsset_productId_color_idx" ON "PhotoAsset"("productId", "color");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_avitoReviewId_key" ON "Review"("avitoReviewId");
CREATE INDEX IF NOT EXISTS "Review_rating_status_idx" ON "Review"("rating", "status");
CREATE INDEX IF NOT EXISTS "Review_avitoCreatedAt_idx" ON "Review"("avitoCreatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReplyDraft_reviewId_key" ON "ReviewReplyDraft"("reviewId");
CREATE INDEX IF NOT EXISTS "ReviewReplyDraft_status_idx" ON "ReviewReplyDraft"("status");
CREATE INDEX IF NOT EXISTS "ReviewReplyDraft_templateId_idx" ON "ReviewReplyDraft"("templateId");
CREATE INDEX IF NOT EXISTS "ReplyTemplate_active_priority_idx" ON "ReplyTemplate"("active", "priority");
`);

addColumnIfMissing(db, "ProductTemplate", "avitoCategorySlug", '"avitoCategorySlug" TEXT');
addColumnIfMissing(db, "ProductTemplate", "avitoCategoryName", '"avitoCategoryName" TEXT');
addColumnIfMissing(db, "ProductTemplate", "avitoFieldsJson", `"avitoFieldsJson" TEXT NOT NULL DEFAULT '{}'`);
addColumnIfMissing(db, "ProductTemplate", "publicationErrorsJson", `"publicationErrorsJson" TEXT NOT NULL DEFAULT '[]'`);
addColumnIfMissing(db, "ProductTemplate", "lastApiSyncAt", '"lastApiSyncAt" DATETIME');

seedDefaultReplyTemplates(db);
ensureAutomationState(db);

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

function addColumnIfMissing(database, table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info("${table}")`).all();
  if (columns.some((item) => item.name === column)) return;
  database.exec(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
}

function seedDefaultReplyTemplates(database) {
  const count = database.prepare('SELECT COUNT(*) AS count FROM "ReplyTemplate"').get().count;
  if (count > 0) return;

  const insert = database.prepare(`
    INSERT INTO "ReplyTemplate" (
      "id", "name", "ratingMin", "ratingMax", "keywords", "text", "priority", "active", "createdAt", "updatedAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const defaults = [
    [
      "default_5_star",
      "5★ благодарность",
      5,
      5,
      "",
      "Спасибо, {name}! Очень рады, что вам понравился товар {itemTitle}. Будем ждать вас снова в {shopName}.",
      50,
    ],
    [
      "default_4_star",
      "4★ благодарность",
      4,
      4,
      "",
      "Спасибо за отзыв, {name}! Если по товару {itemTitle} появятся вопросы, напишите нам в чат — быстро поможем.",
      40,
    ],
    [
      "default_3_star",
      "3★ нейтральный ответ",
      3,
      3,
      "",
      "Спасибо за обратную связь, {name}. Мы внимательно посмотрим, что можно улучшить по товару {itemTitle}.",
      30,
    ],
    [
      "default_1_2_star",
      "1-2★ решение проблемы",
      1,
      2,
      "",
      "{name}, спасибо, что написали. Нам жаль, что товар {itemTitle} не оправдал ожиданий. Пожалуйста, напишите нам в чат — разберемся и предложим решение.",
      20,
    ],
  ];

  for (const item of defaults) {
    insert.run(...item);
  }
}

function ensureAutomationState(database) {
  database
    .prepare(
      `INSERT OR IGNORE INTO "AutomationState" (
        "id", "onlineEnabled", "reviewsEnabled", "draftsEnabled", "status", "capabilitiesJson", "updatedAt"
      ) VALUES ('default', 0, 1, 1, 'IDLE', '{}', CURRENT_TIMESTAMP)`,
    )
    .run();
}
