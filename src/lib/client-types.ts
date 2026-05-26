export type ClientVariant = {
  id: string;
  productId: string;
  color: string;
  size: string;
  sku: string;
  price: number;
  stockQty: number;
  avitoFields: Record<string, string>;
  needsSync: boolean;
  avitoExternalId: string | null;
  publicationStatus: string;
  lastPriceSyncAt: string | null;
  lastStockSyncAt: string | null;
  sortOrder: number;
};

export type ClientColorGroup = {
  id: string;
  productId: string;
  color: string;
  avitoColorValue: string | null;
  basePrice: number;
  defaultStockQty: number;
  description: string;
  avitoFields: Record<string, string>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientPhoto = {
  id: string;
  productId: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  color: string | null;
  sortOrder: number;
  publicUrl: string;
  createdAt: string;
};

export type ClientPublicationRun = {
  id: string;
  productId: string | null;
  feedVersion: string;
  status: string;
  submittedAt: string;
  reportStatus: string | null;
  errors: string[];
  warnings: string[];
  rawReport: string | null;
};

export type ClientProduct = {
  id: string;
  title: string;
  brand: string | null;
  category: string;
  goodsType: string;
  productType: string;
  adType: string;
  gender: string;
  condition: string;
  basePrice: number;
  description: string;
  generatedDescription: string | null;
  avitoCategorySlug: string | null;
  avitoCategoryName: string | null;
  avitoFields: Record<string, string>;
  publicationErrors: string[];
  lastApiSyncAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  variants: ClientVariant[];
  colorGroups: ClientColorGroup[];
  photos: ClientPhoto[];
  publicationRuns: ClientPublicationRun[];
};

export type ClientAvitoSettings = {
  clientId: string;
  hasClientSecret: boolean;
  sellerLocation: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  publicFeedUrl: string;
  redirectUrl: string;
  avitoUserId: string;
  autoloadReportEmail: string;
  autoloadScheduleJson: string;
  capabilities: Record<string, unknown>;
};

export type ClientReplyTemplate = {
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
  createdAt: string;
  updatedAt: string;
};

export type ClientReviewDraft = {
  id: string;
  reviewId: string;
  templateId: string | null;
  text: string;
  status: string;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  template: ClientReplyTemplate | null;
};

export type ClientReview = {
  id: string;
  avitoReviewId: string;
  rating: number;
  text: string;
  authorName: string | null;
  itemId: string | null;
  itemTitle: string | null;
  status: string;
  avitoCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replyDraft: ClientReviewDraft | null;
};

export type ClientAutomationState = {
  id: string;
  onlineEnabled: boolean;
  reviewsEnabled: boolean;
  draftsEnabled: boolean;
  reviewAutoSendEnabled: boolean;
  messagesEnabled: boolean;
  messageAutoRepliesEnabled: boolean;
  reportsEnabled: boolean;
  status: string;
  lastOnlinePingAt: string | null;
  lastReviewsSyncAt: string | null;
  lastReviewAutoSendAt: string | null;
  lastMessagesSyncAt: string | null;
  lastMessageRulesAt: string | null;
  lastReportsSyncAt: string | null;
  lastError: string | null;
  capabilities: Record<string, unknown>;
  updatedAt: string;
};

export type ClientMessageRule = {
  id: string;
  name: string;
  keywords: string;
  responseText: string;
  priority: number;
  cooldownSeconds: number;
  oncePerChat: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientMessage = {
  id: string;
  chatId: string;
  avitoMessageId: string;
  direction: string;
  text: string;
  authorName: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientMessageReplyLog = {
  id: string;
  chatId: string;
  messageId: string | null;
  ruleId: string | null;
  text: string;
  status: string;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  rule?: ClientMessageRule | null;
};

export type ClientMessageChat = {
  id: string;
  avitoChatId: string;
  title: string | null;
  buyerName: string | null;
  itemId: string | null;
  itemTitle: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ClientMessage[];
  replyLogs?: ClientMessageReplyLog[];
};
