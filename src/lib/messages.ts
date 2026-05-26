import { prisma } from "@/lib/prisma";
import { getRawAvitoSettings } from "@/lib/settings";
import { AvitoApiError, explainAvitoError } from "@/lib/avito/client";
import { createAvitoClient } from "@/lib/avito/factory";
import { recordAutomationEvent } from "@/lib/autoload";

type JsonObject = Record<string, unknown>;

export async function listMessageChats() {
  const chats = await prisma.messageChat.findMany({
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    include: {
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
      replyLogs: { orderBy: { createdAt: "desc" }, take: 1, include: { rule: true } },
    },
  });
  return chats.map(toClientChat);
}

export async function getMessageChat(id: string) {
  const chat = await prisma.messageChat.findUnique({
    where: { id },
    include: {
      messages: { orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }] },
      replyLogs: { orderBy: { createdAt: "desc" }, include: { rule: true } },
    },
  });
  return chat ? toClientChat(chat) : null;
}

export async function listMessageRules() {
  const rules = await prisma.messageRule.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }] });
  return rules.map(toClientRule);
}

export async function createMessageRule(input: {
  name: string;
  keywords: string;
  responseText: string;
  priority?: number;
  cooldownSeconds?: number;
  oncePerChat?: boolean;
  active?: boolean;
}) {
  const rule = await prisma.messageRule.create({
    data: {
      name: input.name.trim(),
      keywords: normalizeKeywords(input.keywords).join(", "),
      responseText: normalizeReplyText(input.responseText),
      priority: input.priority ?? 0,
      cooldownSeconds: input.cooldownSeconds ?? 900,
      oncePerChat: input.oncePerChat ?? true,
      active: input.active ?? true,
    },
  });
  return toClientRule(rule);
}

export async function updateMessageRule(
  id: string,
  input: Partial<{
    name: string;
    keywords: string;
    responseText: string;
    priority: number;
    cooldownSeconds: number;
    oncePerChat: boolean;
    active: boolean;
  }>,
) {
  const rule = await prisma.messageRule.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.keywords !== undefined ? { keywords: normalizeKeywords(input.keywords).join(", ") } : {}),
      ...(input.responseText !== undefined ? { responseText: normalizeReplyText(input.responseText) } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.cooldownSeconds !== undefined ? { cooldownSeconds: input.cooldownSeconds } : {}),
      ...(input.oncePerChat !== undefined ? { oncePerChat: input.oncePerChat } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  return toClientRule(rule);
}

export async function deleteMessageRule(id: string) {
  await prisma.messageRule.delete({ where: { id } });
  return { ok: true };
}

export async function syncMessages(options: { force?: boolean } = {}) {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  if (!state.messagesEnabled && !options.force) {
    return { ok: false, skipped: true, synced: 0, message: "Синхронизация сообщений выключена." };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    await markMessagesError("Заполните Client ID и Client Secret.", "MESSAGES_NEEDS_SETTINGS");
    return { ok: false, synced: 0, message: "Заполните Client ID и Client Secret." };
  }

  const client = createAvitoClient(settings);
  try {
    const payload = await client.getChats({ limit: 50 });
    const chats = extractArray(payload, ["chats", "items", "data", "result"]);
    let synced = 0;
    for (const rawChat of chats) {
      const normalized = normalizeChat(rawChat);
      if (!normalized) continue;
      const chat = await upsertChat(normalized);
      const messagesPayload = await client.getMessages(normalized.avitoChatId, { limit: 50 }).catch(() => null);
      const messages = extractArray(messagesPayload, ["messages", "items", "data", "result"]);
      for (const rawMessage of messages) {
        const message = normalizeMessage(rawMessage, chat.id);
        if (!message) continue;
        await upsertMessage(message);
        synced += 1;
      }
    }

    await prisma.automationState.upsert({
      where: { id: "default" },
      create: { id: "default", status: "MESSAGES_SYNCED", lastMessagesSyncAt: new Date() },
      update: { status: "MESSAGES_SYNCED", lastMessagesSyncAt: new Date(), lastError: null },
    });
    await recordAutomationEvent("messages_sync", "OK", `Synced ${synced} messages.`, payload);
    return { ok: true, synced };
  } catch (error) {
    const message = readableAvitoError(error);
    await markMessagesError(message, "MESSAGES_ERROR");
    return { ok: false, synced: 0, message };
  }
}

export async function processMessageRules(options: { force?: boolean } = {}) {
  const state = await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  if ((!state.messagesEnabled || !state.messageAutoRepliesEnabled) && !options.force) {
    return { ok: false, skipped: true, sent: 0, message: "Автоответы в сообщениях выключены." };
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    await markMessagesError("Заполните Client ID и Client Secret.", "MESSAGES_NEEDS_SETTINGS");
    return { ok: false, sent: 0, message: "Заполните Client ID и Client Secret." };
  }

  const rules = await prisma.messageRule.findMany({ where: { active: true }, orderBy: [{ priority: "desc" }] });
  if (!rules.length) return { ok: true, sent: 0, message: "Нет активных правил." };

  const messages = await prisma.message.findMany({
    where: {
      direction: "IN",
      replyLogs: { none: { status: { in: ["SENT", "PENDING"] } } },
    },
    include: { chat: true },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
    take: 50,
  });

  const client = createAvitoClient(settings);
  let sent = 0;
  for (const message of messages) {
    const rule = await findMatchingRule(message.text, message.chatId, rules);
    if (!rule) continue;
    const text = renderMessageTemplate(rule.responseText, {
      buyerName: message.chat.buyerName || "покупатель",
      itemTitle: message.chat.itemTitle || "товар",
      shopName: "SEB0G1SHOPCHIK",
    });

    const log = await prisma.messageReplyLog.create({
      data: {
        chatId: message.chatId,
        messageId: message.id,
        ruleId: rule.id,
        text,
        status: "PENDING",
      },
    });

    try {
      const payload = await client.sendMessage(message.chat.avitoChatId, text);
      await prisma.messageReplyLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date(), rawJson: JSON.stringify(payload), error: null },
      });
      sent += 1;
    } catch (error) {
      await prisma.messageReplyLog.update({
        where: { id: log.id },
        data: { status: "FAILED", error: readableAvitoError(error) },
      });
    }
  }

  await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default", status: "MESSAGE_RULES_PROCESSED", lastMessageRulesAt: new Date() },
    update: { status: "MESSAGE_RULES_PROCESSED", lastMessageRulesAt: new Date(), lastError: null },
  });
  await recordAutomationEvent("message_rules", "OK", `Sent ${sent} replies.`);
  return { ok: true, sent };
}

export async function sendManualMessage(chatId: string, text: string) {
  const chat = await prisma.messageChat.findUnique({ where: { id: chatId } });
  if (!chat) return { ok: false, message: "Чат не найден." };
  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) return { ok: false, message: "Заполните Client ID и Client Secret." };

  const client = createAvitoClient(settings);
  try {
    const payload = await client.sendMessage(chat.avitoChatId, normalizeReplyText(text));
    await prisma.messageReplyLog.create({
      data: {
        chatId: chat.id,
        text: normalizeReplyText(text),
        status: "SENT",
        sentAt: new Date(),
        rawJson: JSON.stringify(payload),
      },
    });
    return { ok: true, payload };
  } catch (error) {
    const message = readableAvitoError(error);
    await prisma.messageReplyLog.create({
      data: {
        chatId: chat.id,
        text: normalizeReplyText(text),
        status: "FAILED",
        error: message,
      },
    });
    return { ok: false, message };
  }
}

export function selectMessageRule<T extends { keywords: string; priority: number; active: boolean }>(text: string, rules: T[]) {
  const normalized = text.toLowerCase();
  return [...rules]
    .filter((rule) => rule.active)
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => normalizeKeywords(rule.keywords).some((keyword) => normalized.includes(keyword.toLowerCase())));
}

async function findMatchingRule(
  text: string,
  chatId: string,
  rules: Array<{
    id: string;
    keywords: string;
    priority: number;
    active: boolean;
    oncePerChat: boolean;
    cooldownSeconds: number;
    responseText: string;
  }>,
) {
  const matched = selectMessageRule(text, rules);
  if (!matched) return null;

  const lastLog = await prisma.messageReplyLog.findFirst({
    where: { chatId, ruleId: matched.id },
    orderBy: { createdAt: "desc" },
  });
  if (!lastLog) return matched;
  if (matched.oncePerChat && lastLog.status === "SENT") return null;
  const cooldownMs = matched.cooldownSeconds * 1000;
  if (Date.now() - lastLog.createdAt.getTime() < cooldownMs) return null;
  return matched;
}

async function markMessagesError(message: string, status: string) {
  await prisma.automationState.upsert({
    where: { id: "default" },
    create: { id: "default", status, lastError: message },
    update: { status, lastError: message },
  });
  await recordAutomationEvent("messages", "ERROR", message);
}

function normalizeKeywords(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeReplyText(value: string) {
  return value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1000);
}

function renderMessageTemplate(text: string, values: Record<string, string>) {
  return normalizeReplyText(text.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => values[key] ?? ""));
}

function normalizeChat(payload: unknown) {
  if (!isObject(payload)) return null;
  const avitoChatId = getString(payload, ["id", "chat_id", "chatId", "uuid"]);
  if (!avitoChatId) return null;
  return {
    avitoChatId,
    title: getString(payload, ["title", "name"]) || null,
    buyerName: getNestedString(payload, ["users", "0", "name"]) || getNestedString(payload, ["buyer", "name"]) || null,
    itemId: getString(payload, ["item_id", "itemId"]) || getNestedString(payload, ["item", "id"]) || null,
    itemTitle: getString(payload, ["item_title", "itemTitle"]) || getNestedString(payload, ["item", "title"]) || null,
    unreadCount: getNumber(payload, ["unread_count", "unreadCount"]) ?? 0,
    lastMessageAt: getDate(payload, ["updated_at", "last_message_at", "lastMessageAt"]) ?? null,
    rawJson: JSON.stringify(payload),
  };
}

function normalizeMessage(payload: unknown, chatId: string) {
  if (!isObject(payload)) return null;
  const avitoMessageId = getString(payload, ["id", "message_id", "messageId", "uuid"]);
  if (!avitoMessageId) return null;
  const text = getString(payload, ["text", "message", "content"]) || getNestedString(payload, ["message", "text"]);
  return {
    chatId,
    avitoMessageId,
    direction: getDirection(payload),
    text,
    authorName: getNestedString(payload, ["author", "name"]) || getString(payload, ["author_name", "authorName"]) || null,
    sentAt: getDate(payload, ["created_at", "createdAt", "sent_at", "sentAt", "date"]) ?? null,
    rawJson: JSON.stringify(payload),
  };
}

async function upsertChat(chat: NonNullable<ReturnType<typeof normalizeChat>>) {
  return prisma.messageChat.upsert({
    where: { avitoChatId: chat.avitoChatId },
    create: chat,
    update: {
      title: chat.title,
      buyerName: chat.buyerName,
      itemId: chat.itemId,
      itemTitle: chat.itemTitle,
      unreadCount: chat.unreadCount,
      lastMessageAt: chat.lastMessageAt,
      rawJson: chat.rawJson,
    },
  });
}

async function upsertMessage(message: NonNullable<ReturnType<typeof normalizeMessage>>) {
  return prisma.message.upsert({
    where: { avitoMessageId: message.avitoMessageId },
    create: message,
    update: {
      direction: message.direction,
      text: message.text,
      authorName: message.authorName,
      sentAt: message.sentAt,
      rawJson: message.rawJson,
    },
  });
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function getDirection(payload: JsonObject) {
  const value = getString(payload, ["direction", "flow", "type"]).toLowerCase();
  if (value.includes("out")) return "OUT";
  if (value.includes("in")) return "IN";
  if (payload.is_outgoing === true || payload.outgoing === true) return "OUT";
  return "IN";
}

function toClientChat(chat: {
  id: string;
  avitoChatId: string;
  title: string | null;
  buyerName: string | null;
  itemId: string | null;
  itemTitle: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{
    id: string;
    chatId: string;
    avitoMessageId: string;
    direction: string;
    text: string;
    authorName: string | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  replyLogs?: Array<{
    id: string;
    chatId: string;
    messageId: string | null;
    ruleId: string | null;
    text: string;
    status: string;
    sentAt: Date | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
    rule?: {
      id: string;
      name: string;
      keywords: string;
      responseText: string;
      priority: number;
      cooldownSeconds: number;
      oncePerChat: boolean;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }>;
}) {
  return {
    id: chat.id,
    avitoChatId: chat.avitoChatId,
    title: chat.title,
    buyerName: chat.buyerName,
    itemId: chat.itemId,
    itemTitle: chat.itemTitle,
    unreadCount: chat.unreadCount,
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    messages: chat.messages?.map(toClientMessage),
    replyLogs: chat.replyLogs?.map((log) => ({
      id: log.id,
      chatId: log.chatId,
      messageId: log.messageId,
      ruleId: log.ruleId,
      text: log.text,
      status: log.status,
      sentAt: log.sentAt?.toISOString() ?? null,
      error: log.error,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
      rule: log.rule ? toClientRule(log.rule) : null,
    })),
  };
}

function toClientMessage(message: {
  id: string;
  chatId: string;
  avitoMessageId: string;
  direction: string;
  text: string;
  authorName: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: message.id,
    chatId: message.chatId,
    avitoMessageId: message.avitoMessageId,
    direction: message.direction,
    text: message.text,
    authorName: message.authorName,
    sentAt: message.sentAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function toClientRule(rule: {
  id: string;
  name: string;
  keywords: string;
  responseText: string;
  priority: number;
  cooldownSeconds: number;
  oncePerChat: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: rule.id,
    name: rule.name,
    keywords: rule.keywords,
    responseText: rule.responseText,
    priority: rule.priority,
    cooldownSeconds: rule.cooldownSeconds,
    oncePerChat: rule.oncePerChat,
    active: rule.active,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

function readableAvitoError(error: unknown): string {
  if (error instanceof AvitoApiError) return explainAvitoError(error);
  return error instanceof Error ? error.message : "Unknown Avito API error";
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = getPath(payload, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function getNestedString(payload: JsonObject, path: string[]) {
  const value = getPath(payload, path.join("."));
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function getNumber(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = getPath(payload, key);
    if (typeof value === "number") return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function getDate(payload: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = getPath(payload, key);
    if (typeof value !== "string" && typeof value !== "number") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function getPath(payload: JsonObject, path: string) {
  let value: unknown = payload;
  for (const part of path.split(".")) {
    if (!isObject(value) && !Array.isArray(value)) return undefined;
    value = Array.isArray(value) ? value[Number(part)] : value[part];
  }
  return value;
}
