type TokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

type AvitoClientOptions = {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
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

  constructor(private readonly options: AvitoClientOptions) {
    this.baseUrl = options.baseUrl || process.env.AVITO_API_BASE_URL || "https://api.avito.ru";
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

  async testConnection(): Promise<{ ok: boolean; status: string; payload?: unknown }> {
    try {
      const payload = await this.request<unknown>("/core/v1/accounts/self");
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
