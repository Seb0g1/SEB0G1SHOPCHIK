import { NextResponse } from "next/server";
import { z } from "zod";
import { getAvitoSettings, getRawAvitoSettings, upsertAvitoSettings } from "@/lib/settings";
import { AvitoClient } from "@/lib/avito/client";

const schema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  sellerLocation: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  publicFeedUrl: z.string().optional(),
  redirectUrl: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ settings: await getAvitoSettings() });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ settings: await upsertAvitoSettings(parsed.data) });
}

export async function POST() {
  const settings = await getRawAvitoSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return NextResponse.json({ ok: false, status: "missing_credentials" }, { status: 400 });
  }

  const client = new AvitoClient({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
  });

  try {
    const result = await client.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "connection_failed",
        message: error instanceof Error ? error.message : "Unknown Avito API error",
      },
      { status: 502 },
    );
  }
}
