import { NextResponse } from "next/server";
import { syncOrders } from "@/lib/orders";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await syncOrders({ force: Boolean(body.force) }));
}
