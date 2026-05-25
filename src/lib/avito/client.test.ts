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
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
