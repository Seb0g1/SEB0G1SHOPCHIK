import { NextResponse } from "next/server";
import { probeAutomationCapabilities } from "@/lib/reviews";

export async function POST() {
  return NextResponse.json({ automation: await probeAutomationCapabilities() });
}
