import { NextResponse } from "next/server";
import { triggerAutoloadUpload } from "@/lib/autoload";

export async function POST() {
  return NextResponse.json(await triggerAutoloadUpload());
}
