import { NextResponse } from "next/server";
import { z } from "zod";
import { explainAvitoCredentialStatus, getAvitoCredentialStatus, getAvitoSettings, getRawAvitoSettings, upsertAvitoSettings } from "@/lib/settings";
import { createAvitoClient } from "@/lib/avito/factory";
import { saveCapabilities } from "@/lib/autoload";

const schema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  avitoUserId: z.string().optional(),
  sellerLocation: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  publicFeedUrl: z.string().optional(),
  redirectUrl: z.string().optional(),
  autoloadReportEmail: z.string().optional(),
  autoloadScheduleJson: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ settings: await getAvitoSettings() });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload", details: parsed.error.flatten() }, { status: 400 });
  }
  await upsertAvitoSettings(parsed.data);
  return NextResponse.json({ settings: await getAvitoSettings() });
}

export async function POST() {
  const credentialStatus = await getAvitoCredentialStatus();
  if (!credentialStatus.hasClientId || !credentialStatus.hasClientSecret) {
    const invalidSecret = credentialStatus.secretStatus === "invalid";
    const message = explainAvitoCredentialStatus(credentialStatus);
    return NextResponse.json(
      {
        ok: false,
        status: invalidSecret ? "invalid_client_secret" : "missing_credentials",
        message,
        credentialStatus,
      },
      { status: 400 },
    );
  }

  const settings = await getRawAvitoSettings();

  const client = createAvitoClient(settings);

  try {
    const result = await client.testConnection();
    const capabilities = await client.probeCapabilities();
    await saveCapabilities(capabilities);
    return NextResponse.json({ ...result, capabilities });
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
