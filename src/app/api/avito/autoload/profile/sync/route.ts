import { NextResponse } from "next/server";
import { syncAutoloadProfile } from "@/lib/autoload";

export async function POST() {
  return NextResponse.json(await syncAutoloadProfile());
}
