import { NextResponse } from "next/server";
import { syncAutoloadReports } from "@/lib/autoload";

export async function POST() {
  return NextResponse.json(await syncAutoloadReports());
}
