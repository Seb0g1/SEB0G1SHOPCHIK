import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  "supplierId" TEXT,
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
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductTemplate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductVariant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "stockQty" INTEGER NOT NULL DEFAULT 1,
  "avitoFieldsJson" TEXT NOT NULL DEFAULT '{}',
  "needsSync" BOOLEAN NOT NULL DEFAULT 0,
  "avitoExternalId" TEXT,
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "lastPriceSyncAt" DATETIME,
  "lastStockSyncAt" DATETIME,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductColorGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "supplierId" TEXT,
  "color" TEXT NOT NULL,
  "avitoColorValue" TEXT,
  "basePrice" INTEGER NOT NULL DEFAULT 0,
  "defaultStockQty" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT NOT NULL DEFAULT '',
  "avitoFieldsJson" TEXT NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductColorGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductColorGroup_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "telegram" TEXT,
  "website" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "defaultMessageTemplate" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "CustomerOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "avitoOrderId" TEXT NOT NULL,
  "avitoItemId" TEXT,
  "avitoChatId" TEXT,
  "buyerName" TEXT,
  "buyerPhone" TEXT,
  "itemTitle" TEXT,
  "color" TEXT,
  "size" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "price" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "deliveryText" TEXT,
  "productId" TEXT,
  "variantId" TEXT,
  "rawJson" TEXT NOT NULL DEFAULT '{}',
  "avitoCreatedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CustomerOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CustomerOrder_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SupplierTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "supplierId" TEXT,
  "generatedMessage" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "notes" TEXT NOT NULL DEFAULT '',
  "copiedAt" DATETIME,
  "contactedAt" DATETIME,
  "doneAt" DATETIME,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SupplierTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierTask_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
  "avitoUserId" TEXT,
  "sellerLocation" TEXT,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "publicFeedUrl" TEXT,
  "redirectUrl" TEXT,
  "autoloadReportEmail" TEXT,
  "autoloadScheduleJson" TEXT NOT NULL DEFAULT '[]',
  "capabilitiesJson" TEXT NOT NULL DEFAULT '{}',
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
  "autoSend" BOOLEAN NOT NULL DEFAULT 0,
  "kind" TEXT NOT NULL DEFAULT 'REVIEW',
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
  "reviewAutoSendEnabled" BOOLEAN NOT NULL DEFAULT 1,
  "messagesEnabled" BOOLEAN NOT NULL DEFAULT 0,
  "messageAutoRepliesEnabled" BOOLEAN NOT NULL DEFAULT 0,
  "reportsEnabled" BOOLEAN NOT NULL DEFAULT 1,
  "ordersEnabled" BOOLEAN NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "lastOnlinePingAt" DATETIME,
  "lastReviewsSyncAt" DATETIME,
  "lastReviewAutoSendAt" DATETIME,
  "lastMessagesSyncAt" DATETIME,
  "lastMessageRulesAt" DATETIME,
  "lastReportsSyncAt" DATETIME,
  "lastOrdersSyncAt" DATETIME,
  "lastError" TEXT,
  "capabilitiesJson" TEXT NOT NULL DEFAULT '{}',
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "BulkPriceOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scope" TEXT NOT NULL DEFAULT 'PRODUCT',
  "filterJson" TEXT NOT NULL DEFAULT '{}',
  "mode" TEXT NOT NULL,
  "value" REAL NOT NULL,
  "rounding" TEXT NOT NULL DEFAULT 'NONE',
  "previewCount" INTEGER NOT NULL DEFAULT 0,
  "appliedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "errorsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "MessageChat" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "avitoChatId" TEXT NOT NULL,
  "title" TEXT,
  "buyerName" TEXT,
  "itemId" TEXT,
  "itemTitle" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" DATETIME,
  "rawJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "avitoMessageId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "authorName" TEXT,
  "sentAt" DATETIME,
  "rawJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "MessageChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MessageRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "keywords" TEXT NOT NULL DEFAULT '',
  "responseText" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 900,
  "oncePerChat" BOOLEAN NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "MessageReplyLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "messageId" TEXT,
  "ruleId" TEXT,
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" DATETIME,
  "error" TEXT,
  "rawJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MessageReplyLog_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "MessageChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageReplyLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MessageReplyLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "MessageRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AutomationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "task" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "payloadJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_color_idx" ON "ProductVariant"("productId", "color");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_productId_color_size_key" ON "ProductVariant"("productId", "color", "size");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductColorGroup_productId_color_key" ON "ProductColorGroup"("productId", "color");
CREATE INDEX IF NOT EXISTS "ProductColorGroup_productId_sortOrder_idx" ON "ProductColorGroup"("productId", "sortOrder");
CREATE INDEX IF NOT EXISTS "Supplier_active_name_idx" ON "Supplier"("active", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOrder_avitoOrderId_key" ON "CustomerOrder"("avitoOrderId");
CREATE INDEX IF NOT EXISTS "CustomerOrder_status_avitoCreatedAt_idx" ON "CustomerOrder"("status", "avitoCreatedAt");
CREATE INDEX IF NOT EXISTS "CustomerOrder_productId_idx" ON "CustomerOrder"("productId");
CREATE INDEX IF NOT EXISTS "CustomerOrder_variantId_idx" ON "CustomerOrder"("variantId");
CREATE INDEX IF NOT EXISTS "CustomerOrder_avitoItemId_idx" ON "CustomerOrder"("avitoItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierTask_orderId_key" ON "SupplierTask"("orderId");
CREATE INDEX IF NOT EXISTS "SupplierTask_supplierId_status_idx" ON "SupplierTask"("supplierId", "status");
CREATE INDEX IF NOT EXISTS "SupplierTask_status_idx" ON "SupplierTask"("status");
CREATE INDEX IF NOT EXISTS "PhotoAsset_productId_color_idx" ON "PhotoAsset"("productId", "color");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_avitoReviewId_key" ON "Review"("avitoReviewId");
CREATE INDEX IF NOT EXISTS "Review_rating_status_idx" ON "Review"("rating", "status");
CREATE INDEX IF NOT EXISTS "Review_avitoCreatedAt_idx" ON "Review"("avitoCreatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReplyDraft_reviewId_key" ON "ReviewReplyDraft"("reviewId");
CREATE INDEX IF NOT EXISTS "ReviewReplyDraft_status_idx" ON "ReviewReplyDraft"("status");
CREATE INDEX IF NOT EXISTS "ReviewReplyDraft_templateId_idx" ON "ReviewReplyDraft"("templateId");
CREATE UNIQUE INDEX IF NOT EXISTS "MessageChat_avitoChatId_key" ON "MessageChat"("avitoChatId");
CREATE INDEX IF NOT EXISTS "MessageChat_lastMessageAt_idx" ON "MessageChat"("lastMessageAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Message_avitoMessageId_key" ON "Message"("avitoMessageId");
CREATE INDEX IF NOT EXISTS "Message_chatId_sentAt_idx" ON "Message"("chatId", "sentAt");
CREATE INDEX IF NOT EXISTS "Message_direction_idx" ON "Message"("direction");
CREATE INDEX IF NOT EXISTS "MessageRule_active_priority_idx" ON "MessageRule"("active", "priority");
CREATE INDEX IF NOT EXISTS "MessageReplyLog_chatId_status_idx" ON "MessageReplyLog"("chatId", "status");
CREATE INDEX IF NOT EXISTS "MessageReplyLog_messageId_idx" ON "MessageReplyLog"("messageId");
CREATE INDEX IF NOT EXISTS "MessageReplyLog_ruleId_idx" ON "MessageReplyLog"("ruleId");
CREATE INDEX IF NOT EXISTS "AutomationEvent_task_createdAt_idx" ON "AutomationEvent"("task", "createdAt");
CREATE INDEX IF NOT EXISTS "AutomationEvent_status_idx" ON "AutomationEvent"("status");
`);

addColumnIfMissing(db, "ProductTemplate", "avitoCategorySlug", '"avitoCategorySlug" TEXT');
addColumnIfMissing(db, "ProductTemplate", "avitoCategoryName", '"avitoCategoryName" TEXT');
addColumnIfMissing(db, "ProductTemplate", "avitoFieldsJson", `"avitoFieldsJson" TEXT NOT NULL DEFAULT '{}'`);
addColumnIfMissing(db, "ProductTemplate", "publicationErrorsJson", `"publicationErrorsJson" TEXT NOT NULL DEFAULT '[]'`);
addColumnIfMissing(db, "ProductTemplate", "lastApiSyncAt", '"lastApiSyncAt" DATETIME');
addColumnIfMissing(db, "ProductTemplate", "supplierId", '"supplierId" TEXT');
addColumnIfMissing(db, "ProductVariant", "avitoFieldsJson", `"avitoFieldsJson" TEXT NOT NULL DEFAULT '{}'`);
addColumnIfMissing(db, "ProductVariant", "needsSync", '"needsSync" BOOLEAN NOT NULL DEFAULT 0');
addColumnIfMissing(db, "ProductVariant", "lastPriceSyncAt", '"lastPriceSyncAt" DATETIME');
addColumnIfMissing(db, "ProductVariant", "lastStockSyncAt", '"lastStockSyncAt" DATETIME');
addColumnIfMissing(db, "ProductColorGroup", "supplierId", '"supplierId" TEXT');
db.exec('CREATE INDEX IF NOT EXISTS "ProductTemplate_supplierId_idx" ON "ProductTemplate"("supplierId")');
db.exec('CREATE INDEX IF NOT EXISTS "ProductColorGroup_supplierId_idx" ON "ProductColorGroup"("supplierId")');
addColumnIfMissing(db, "AvitoSettings", "avitoUserId", '"avitoUserId" TEXT');
addColumnIfMissing(db, "AvitoSettings", "autoloadReportEmail", '"autoloadReportEmail" TEXT');
addColumnIfMissing(db, "AvitoSettings", "autoloadScheduleJson", `"autoloadScheduleJson" TEXT NOT NULL DEFAULT '[]'`);
addColumnIfMissing(db, "AvitoSettings", "capabilitiesJson", `"capabilitiesJson" TEXT NOT NULL DEFAULT '{}'`);
addColumnIfMissing(db, "ReplyTemplate", "autoSend", '"autoSend" BOOLEAN NOT NULL DEFAULT 0');
addColumnIfMissing(db, "ReplyTemplate", "kind", `"kind" TEXT NOT NULL DEFAULT 'REVIEW'`);
db.exec('CREATE INDEX IF NOT EXISTS "ReplyTemplate_kind_active_priority_idx" ON "ReplyTemplate"("kind", "active", "priority")');
addColumnIfMissing(db, "AutomationState", "reviewAutoSendEnabled", '"reviewAutoSendEnabled" BOOLEAN NOT NULL DEFAULT 1');
addColumnIfMissing(db, "AutomationState", "messagesEnabled", '"messagesEnabled" BOOLEAN NOT NULL DEFAULT 0');
addColumnIfMissing(db, "AutomationState", "messageAutoRepliesEnabled", '"messageAutoRepliesEnabled" BOOLEAN NOT NULL DEFAULT 0');
addColumnIfMissing(db, "AutomationState", "reportsEnabled", '"reportsEnabled" BOOLEAN NOT NULL DEFAULT 1');
addColumnIfMissing(db, "AutomationState", "ordersEnabled", '"ordersEnabled" BOOLEAN NOT NULL DEFAULT 1');
addColumnIfMissing(db, "AutomationState", "lastReviewAutoSendAt", '"lastReviewAutoSendAt" DATETIME');
addColumnIfMissing(db, "AutomationState", "lastMessagesSyncAt", '"lastMessagesSyncAt" DATETIME');
addColumnIfMissing(db, "AutomationState", "lastMessageRulesAt", '"lastMessageRulesAt" DATETIME');
addColumnIfMissing(db, "AutomationState", "lastReportsSyncAt", '"lastReportsSyncAt" DATETIME');
addColumnIfMissing(db, "AutomationState", "lastOrdersSyncAt", '"lastOrdersSyncAt" DATETIME');

seedDefaultReplyTemplates(db);
backfillColorGroups(db);
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

function backfillColorGroups(database) {
  const rows = database
    .prepare(
      `SELECT
        v."productId" AS productId,
        v."color" AS color,
        MIN(v."price") AS basePrice,
        MAX(v."stockQty") AS stockQty,
        MIN(v."sortOrder") AS sortOrder
      FROM "ProductVariant" v
      WHERE TRIM(v."color") <> ''
      GROUP BY v."productId", v."color"`,
    )
    .all();

  const insert = database.prepare(`
    INSERT OR IGNORE INTO "ProductColorGroup" (
      "id", "productId", "color", "avitoColorValue", "basePrice", "defaultStockQty",
      "description", "avitoFieldsJson", "sortOrder", "createdAt", "updatedAt"
    ) VALUES (?, ?, ?, ?, ?, ?, '', '{}', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  for (const row of rows) {
    insert.run(
      `cg_${randomUUID().replaceAll("-", "")}`,
      row.productId,
      row.color,
      row.color,
      Number(row.basePrice || 0),
      Number(row.stockQty || 1),
      Number(row.sortOrder || 0),
    );
  }
}

function seedDefaultReplyTemplates(database) {
  const count = database.prepare('SELECT COUNT(*) AS count FROM "ReplyTemplate"').get().count;
  if (count > 0) return;

  const insert = database.prepare(`
    INSERT INTO "ReplyTemplate" (
      "id", "name", "ratingMin", "ratingMax", "keywords", "text", "priority", "active", "autoSend", "kind", "createdAt", "updatedAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'REVIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
        "id", "onlineEnabled", "reviewsEnabled", "draftsEnabled", "reviewAutoSendEnabled", "messagesEnabled",
        "messageAutoRepliesEnabled", "reportsEnabled", "ordersEnabled", "status", "capabilitiesJson", "updatedAt"
      ) VALUES ('default', 0, 1, 1, 1, 0, 0, 1, 1, 'IDLE', '{}', CURRENT_TIMESTAMP)`,
    )
    .run();
}
