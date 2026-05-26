import { NextResponse } from "next/server";
import { AvitoClient } from "@/lib/avito/client";
import { getRawAvitoSettings, saveAvitoOAuthTokens } from "@/lib/settings";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(
      `<html><body><h1>Avito OAuth error</h1><p>${escapeHtml(error)}</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing OAuth code" }, { status: 400 });
  }

  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return new Response(
      `<html><body><h1>Avito OAuth</h1><p>Сначала сохраните Client ID и Client secret в настройках SEB0G1SHOPCHIK.</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }

  try {
    const client = new AvitoClient({ clientId: settings.clientId, clientSecret: settings.clientSecret });
    const tokens = await client.exchangeAuthorizationCode(code, settings.redirectUrl);
    await saveAvitoOAuthTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    return new Response(
      `<html><body><h1>Avito подключен</h1><p>OAuth-токен сохранен. Можно закрыть эту вкладку и вернуться в SEB0G1SHOPCHIK.</p><p><a href="/settings">Открыть настройки</a></p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (tokenError) {
    const message = tokenError instanceof Error ? tokenError.message : "OAuth token exchange failed";
    return new Response(
      `<html><body><h1>Avito OAuth error</h1><p>${escapeHtml(message)}</p><p>Проверьте, что Redirect URL в Avito и в настройках сайта совпадает один в один.</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char] ?? char;
  });
}
