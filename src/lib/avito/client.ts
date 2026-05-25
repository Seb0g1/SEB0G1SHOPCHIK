type TokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

type AvitoClientOptions = {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  accountId?: string;
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
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.token;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
    });

    const response = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await safeJson(response)) as Partial<TokenResponse>;
    if (!response.ok || !payload.access_token) {
      throw new AvitoApiError("Avito OAuth token request failed.", response.status, payload);
    }

    cachedToken = {
      token: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };

    return payload.access_token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new AvitoApiError("Avito API request failed.", response.status, payload);
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
      throw new AvitoApiError("Avito API request failed.", response.status, payload);
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
    const path = configuredPath("AVITO_ONLINE_PRESENCE_PATH", "/messenger/v1/accounts/{accountId}/online", {
      accountId: this.accountId,
    });
    return this.requestConfigured(path, {
      method: "POST",
      body: JSON.stringify({ online: true }),
    });
  }

  async probeCapabilities(): Promise<Record<string, CapabilityProbeResult>> {
    const result: Record<string, CapabilityProbeResult> = {};

    result.profile = await probeCapability(() => this.getProfile());
    result.reviews = await probeCapability(() => this.getReviews({ limit: 1 }));
    result.reviewReplies = configuredPathAvailable("AVITO_REVIEW_REPLY_PATH")
      ? { available: true, status: "configured" }
      : { available: false, status: "missing_endpoint", message: "Путь отправки ответов не настроен." };
    result.onlinePresence = await probeCapability(() => this.setOnlinePresence());

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
  const raw = process.env[envName];
  if (raw !== undefined && raw.trim() === "") {
    throw new AvitoApiError(`${envName} is not configured.`, 0, { code: "endpoint_not_configured" });
  }

  return replacePathVariables(raw || fallback, values);
}

function configuredPathAvailable(envName: string): boolean {
  const raw = process.env[envName];
  return raw === undefined || raw.trim().length > 0;
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

export function explainAvitoError(error: AvitoApiError): string {
  if (error.status === 0) return "Endpoint Avito API не настроен в .env.";
  if (error.status === 401) return "Avito API отклонил OAuth-токен. Проверьте Client ID и Client Secret.";
  if (error.status === 403) return "Avito API недоступен для этого приложения или тарифа.";
  if (error.status === 404) return "Endpoint Avito API не найден. Проверьте путь в API catalog и .env.";
  if (error.status === 429) return "Avito API ограничил частоту запросов. Worker продолжит позже.";
  return error.message || "Ошибка Avito API.";
}
