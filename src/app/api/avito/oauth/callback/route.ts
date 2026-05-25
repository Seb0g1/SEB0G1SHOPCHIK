import { NextResponse } from "next/server";

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

  return new Response(
    `<html><body><h1>Avito OAuth code received</h1><p>Code saved by browser session. Paste it into the app if your Avito cabinet requires authorization-code exchange.</p><pre>${escapeHtml(code)}</pre></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
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
