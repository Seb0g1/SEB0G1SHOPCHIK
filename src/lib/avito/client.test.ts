import { afterEach, describe, expect, it, vi } from "vitest";
import { AvitoApiError, AvitoClient, resetAvitoTokenCache } from "@/lib/avito/client";

describe("AvitoClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetAvitoTokenCache();
  });

  it("caches token between requests", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        String(url).endsWith("/token")
          ? jsonResponse({ access_token: "token-1", expires_in: 3600 })
          : jsonResponse({ ok: true }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });
    await client.request("/one");
    await client.request("/two");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/token");
    const secondCallInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const thirdCallInit = fetchMock.mock.calls[2]?.[1] as RequestInit | undefined;
    expect((secondCallInit?.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
    expect((thirdCallInit?.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
  });

  it("maps API errors to AvitoApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse({ error: "bad" }, 400)),
    );

    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });
    await expect(client.request("/bad")).rejects.toBeInstanceOf(AvitoApiError);
  });

  it("exchanges OAuth code without redirect_uri by default", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: "oauth-token", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });
    await client.exchangeAuthorizationCode("code-1");

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code-1");
    expect(body.has("redirect_uri")).toBe(false);
  });

  it("can include redirect_uri for OAuth code exchange when explicitly requested", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: "oauth-token", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });
    await client.exchangeAuthorizationCode("code-1", "https://amsterdam2.sebog1.ru/");

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams;
    expect(body.get("redirect_uri")).toBe("https://amsterdam2.sebog1.ru/");
  });

  it("uses env-configured review reply endpoint", async () => {
    vi.stubEnv("AVITO_REVIEW_REPLY_PATH", "/custom/reviews/{reviewId}/reply");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });
    await client.sendReviewReply("review 1", "Спасибо");

    expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/custom/reviews/review%201/reply");
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(JSON.stringify({ text: "Спасибо" }));
  });

  it("falls back to built-in order endpoint when compose passes an empty env value", async () => {
    vi.stubEnv("AVITO_ORDERS_LIST_PATH", "");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ orders: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });
    await client.getOrders({ limit: 1 });

    expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/order-management/1/orders?limit=1");
  });

  it("does not call an undocumented online endpoint by default", async () => {
    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });

    await expect(client.setOnlinePresence()).rejects.toMatchObject({
      status: 0,
      endpoint: "AVITO_ONLINE_PRESENCE_PATH",
    });
  });

  it("treats the old placeholder online endpoint as disabled", async () => {
    vi.stubEnv("AVITO_ONLINE_PRESENCE_PATH", "/messenger/v1/accounts/{accountId}/online");
    const client = new AvitoClient({ clientId: "id", clientSecret: "secret", baseUrl: "https://api.test" });

    await expect(client.setOnlinePresence()).rejects.toMatchObject({
      status: 0,
      endpoint: "AVITO_ONLINE_PRESENCE_PATH",
    });
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
