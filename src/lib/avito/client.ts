type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type AvitoClientOptions = {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  accountId?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | string | null;
  onTokenUpdate?: (tokens: { accessToken: string; refreshToken?: string | null; expiresIn?: number | null }) => Promise<void>;
};

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

export class AvitoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
    public readonly endpoint?: string,
  ) {
    super(message);
  }
}

export class AvitoClient {
  private readonly baseUrl: string;
  private readonly accountId: string;

  constructor(private readonly options: AvitoClientOptions) {
    this.baseUrl = options.baseUrl || process.env.AVITO_API_BASE_URL || "https://api.avito.ru";
    this.accountId = options.accountId || process.env.AVITO_ACCOUNT_ID || "self";
  }

  async getAccessToken(): Promise<string> {
    const configuredExpiresAt = this.options.tokenExpiresAt ? new Date(this.options.tokenExpiresAt).getTime() : 0;
    if (this.options.accessToken && configuredExpiresAt > Date.now() + 60_000) {
      cachedToken = { token: this.options.accessToken, expiresAt: configuredExpiresAt };
      return this.options.accessToken;
    }

    if (this.options.refreshToken) {
      const payload = await this.requestOAuthToken({
        grant_type: "refresh_token",
        refresh_token: this.options.refreshToken,
      });
      await this.options.onTokenUpdate?.({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? this.options.refreshToken,
        expiresIn: payload.expires_in,
      });
      cachedToken = {
        token: payload.access_token,
        expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
      };
      return payload.access_token;
    }

    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.token;
    }

    const payload = await this.requestOAuthToken({
      grant_type: "client_credentials",
    });

    cachedToken = {
      token: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };

    return payload.access_token;
  }

  async exchangeAuthorizationCode(code: string, redirectUrl?: string): Promise<TokenResponse> {
    return this.requestOAuthToken({
      grant_type: "authorization_code",
      code,
      ...(redirectUrl ? { redirect_uri: redirectUrl } : {}),
    });
  }

  private async requestOAuthToken(params: Record<string, string>): Promise<TokenResponse> {
    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      ...params,
    });

    const response = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await safeJson(response)) as Partial<TokenResponse>;
    if (!response.ok || !payload.access_token) {
      throw new AvitoApiError("Avito OAuth token request failed.", response.status, payload, "/token");
    }

    return payload as TokenResponse;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const endpoint = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    const response = await fetch(endpoint, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new AvitoApiError("Avito API request failed.", response.status, payload, endpoint);
    }
    return payload as T;
  }

  async requestUrl<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new AvitoApiError("Avito API request failed.", response.status, payload, url);
    }
    return payload as T;
  }

  async getProfile(): Promise<unknown> {
    return this.request("/core/v1/accounts/self");
  }

  async getCatalogTree(): Promise<unknown> {
    return this.request("/autoload/v1/user-docs/tree");
  }

  async getNodeFields(slug: string): Promise<unknown> {
    return this.request(`/autoload/v1/user-docs/node/${encodeURIComponent(slug)}/fields`);
  }

  async getAutoloadProfile(): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_PROFILE_PATH", "/autoload/v2/profile", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path);
  }

  async syncAutoloadProfile(input: {
    feedUrl: string;
    feedName?: string;
    reportEmail: string;
    schedule?: unknown[];
    enabled?: boolean;
  }): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_PROFILE_PATH", "/autoload/v2/profile", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, {
      method: "POST",
      body: JSON.stringify({
        autoload_enabled: input.enabled ?? true,
        feeds_data: [{ feed_name: input.feedName || "SEB0G1SHOPCHIK", feed_url: input.feedUrl }],
        report_email: input.reportEmail,
        schedule: normalizeAutoloadSchedule(input.schedule),
        agreement: true,
      }),
    });
  }

  async triggerAutoloadUpload(): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_UPLOAD_PATH", "/autoload/v1/upload", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, { method: "POST" });
  }

  async getAutoloadReports(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_REPORTS_PATH", "/autoload/v2/reports", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, { method: "GET" }, params);
  }

  async getAutoloadLastReport(): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_LAST_REPORT_PATH", "/autoload/v3/reports/last_completed_report", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path);
  }

  async getAutoloadReport(reportId: string | number): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_REPORT_PATH", "/autoload/v3/reports/{reportId}", {
      accountId: this.accountId,
      reportId: String(reportId),
    });
    return this.requestConfigured(path);
  }

  async getAutoloadReportItems(
    reportId: string | number,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<unknown> {
    const path = configuredPath("AVITO_AUTOLOAD_REPORT_ITEMS_PATH", "/autoload/v2/reports/{reportId}/items", {
      accountId: this.accountId,
      reportId: String(reportId),
    });
    return this.requestConfigured(path, { method: "GET" }, params);
  }

  async getReviews(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const path = configuredPath("AVITO_REVIEWS_LIST_PATH", "/ratings/v1/reviews", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, { method: "GET" }, params);
  }

  async getReview(reviewId: string): Promise<unknown> {
    const listPath = configuredPath("AVITO_REVIEWS_LIST_PATH", "/ratings/v1/reviews", {
      accountId: this.accountId,
    });
    const fallback = `${listPath.replace(/\/$/, "")}/{reviewId}`;
    const path = configuredPath("AVITO_REVIEW_DETAIL_PATH", fallback, {
      accountId: this.accountId,
      reviewId,
    });
    return this.requestConfigured(path, { method: "GET" });
  }

  async sendReviewReply(reviewId: string, text: string): Promise<unknown> {
    const path = configuredPath("AVITO_REVIEW_REPLY_PATH", "/ratings/v1/reviews/{reviewId}/reply", {
      accountId: this.accountId,
      reviewId,
    });
    return this.requestConfigured(path, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  async setOnlinePresence(): Promise<unknown> {
    const rawOnlinePath = process.env.AVITO_ONLINE_PRESENCE_PATH?.trim();
    if (!rawOnlinePath || rawOnlinePath === "/messenger/v1/accounts/{accountId}/online") {
      throw new AvitoApiError(
        "AVITO_ONLINE_PRESENCE_PATH is not configured.",
        0,
        { code: "endpoint_not_configured", envName: "AVITO_ONLINE_PRESENCE_PATH" },
        "AVITO_ONLINE_PRESENCE_PATH",
      );
    }
    const path = configuredPath("AVITO_ONLINE_PRESENCE_PATH", "", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, {
      method: "POST",
      body: JSON.stringify({ online: true }),
    });
  }

  async getChats(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const path = configuredPath("AVITO_MESSENGER_CHATS_PATH", "/messenger/v2/accounts/{accountId}/chats", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, { method: "GET" }, params);
  }

  async getMessages(chatId: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const path = configuredPath("AVITO_MESSENGER_MESSAGES_PATH", "/messenger/v3/accounts/{accountId}/chats/{chatId}/messages", {
      accountId: this.accountId,
      chatId,
    });
    return this.requestConfigured(path, { method: "GET" }, params);
  }

  async sendMessage(chatId: string, text: string): Promise<unknown> {
    const path = configuredPath("AVITO_MESSENGER_SEND_PATH", "/messenger/v1/accounts/{accountId}/chats/{chatId}/messages", {
      accountId: this.accountId,
      chatId,
    });
    return this.requestConfigured(path, {
      method: "POST",
      body: JSON.stringify({ message: { text }, type: "text" }),
    });
  }

  async getOrders(params: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    const path = configuredPath("AVITO_ORDERS_LIST_PATH", "/order-management/1/orders", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, { method: "GET" }, params);
  }

  async getOrder(orderId: string): Promise<unknown> {
    const path = configuredPath("AVITO_ORDER_DETAIL_PATH", "/order-management/1/orders/{orderId}", {
      accountId: this.accountId,
      orderId,
    });
    return this.requestConfigured(path, { method: "GET" });
  }

  async probeCapabilities(): Promise<Record<string, CapabilityProbeResult>> {
    const result: Record<string, CapabilityProbeResult> = {};

    result.profile = await probeCapability(() => this.getProfile());
    result.autoloadProfile = await probeCapability(() => this.getAutoloadProfile());
    result.autoloadReports = await probeCapability(() => this.getAutoloadReports({ per_page: 1, page: 0 }));
    result.reviews = await probeCapability(() => this.getReviews({ limit: 1 }));
    result.reviewReplies = configuredPathAvailable("AVITO_REVIEW_REPLY_PATH")
      ? { available: true, status: "configured" }
      : { available: false, status: "missing_endpoint", message: "Путь отправки ответов не настроен." };
    result.onlinePresence = await probeCapability(() => this.setOnlinePresence());
    result.messenger = await probeCapability(() => this.getChats({ limit: 1 }));
    result.orders = await probeCapability(() => this.getOrders({ limit: 1, per_page: 1, page: 0 }));

    return result;
  }

  async requestConfigured<T>(
    pathOrUrl: string,
    init: RequestInit = {},
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const target = appendQuery(pathOrUrl, query);
    if (/^https?:\/\//i.test(target)) {
      return this.requestUrl<T>(target, init);
    }
    return this.request<T>(target, init);
  }

  async testConnection(): Promise<{ ok: boolean; status: string; payload?: unknown }> {
    try {
      const payload = await this.getProfile();
      return { ok: true, status: "connected", payload };
    } catch (error) {
      if (error instanceof AvitoApiError && error.status === 404) {
        return { ok: true, status: "token_ok_profile_endpoint_unavailable", payload: error.payload };
      }
      throw error;
    }
  }
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function resetAvitoTokenCache() {
  cachedToken = null;
}

type CapabilityProbeResult = {
  available: boolean;
  status: string | number;
  message?: string;
  endpoint?: string;
  payload?: unknown;
};

async function probeCapability(action: () => Promise<unknown>): Promise<CapabilityProbeResult> {
  try {
    const payload = await action();
    return { available: true, status: "ok", payload };
  } catch (error) {
    if (error instanceof AvitoApiError) {
      return {
        available: false,
        status: error.status || "not_configured",
        message: explainAvitoError(error),
        endpoint: error.endpoint,
        payload: error.payload,
      };
    }
    return {
      available: false,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown Avito API error",
    };
  }
}

function configuredPath(envName: string, fallback: string, values: Record<string, string>): string {
  const raw = process.env[envName]?.trim();
  if (raw && ["disabled", "off", "none", "false"].includes(raw.toLowerCase())) {
    throw new AvitoApiError(`${envName} is not configured.`, 0, { code: "endpoint_not_configured", envName }, envName);
  }

  if (!raw && !fallback) {
    throw new AvitoApiError(`${envName} is not configured.`, 0, { code: "endpoint_not_configured", envName }, envName);
  }

  return replacePathVariables(raw || fallback, values);
}

function configuredPathAvailable(envName: string): boolean {
  const raw = process.env[envName]?.trim().toLowerCase();
  return raw === undefined || !["disabled", "off", "none", "false"].includes(raw);
}

function replacePathVariables(path: string, values: Record<string, string>): string {
  return path.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => encodeURIComponent(values[key] || ""));
}

function appendQuery(pathOrUrl: string, query?: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(query ?? {}).filter(([, value]) => value !== undefined && value !== "");
  if (entries.length === 0) return pathOrUrl;

  const separator = pathOrUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, String(value));
  }
  return `${pathOrUrl}${separator}${params.toString()}`;
}

function normalizeAutoloadSchedule(schedule?: unknown[]): unknown[] {
  if (Array.isArray(schedule) && schedule.length) return schedule;
  return [
    {
      rate: 100,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      time_slots: [0, 6, 12, 18],
    },
  ];
}

export function explainAvitoError(error: AvitoApiError): string {
  const endpoint = error.endpoint ? ` Путь: ${error.endpoint}.` : "";
  const payload = error.payload && typeof error.payload === "object" ? (error.payload as Record<string, unknown>) : {};
  if (error.status === 0 && payload.envName === "AVITO_ONLINE_PRESENCE_PATH") {
    return `Официальный endpoint Avito для постоянного online не настроен или недоступен для приложения. Online отключен без браузерной имитации.${endpoint}`;
  }
  if (error.status === 0) return `Endpoint Avito API не настроен в .env.${endpoint}`;
  if (error.status === 401) return `Avito API отклонил токен. Проверьте Client ID и Client Secret. Для персональной авторизации OAuth-страница Avito не нужна: приложение получает token через client_credentials.${endpoint}`;
  if (error.status === 403) return `Avito API недоступен для этого приложения, аккаунта или тарифа.${endpoint}`;
  if (error.status === 404) return `Avito вернул 404 по конкретному методу API. Это значит, что путь не совпадает с вашим Swagger/API catalog или раздел не подключен к приложению.${endpoint}`;
  if (error.status === 429) return `Avito API ограничил частоту запросов. Worker продолжит позже.${endpoint}`;
  return error.message || "Ошибка Avito API.";
}
