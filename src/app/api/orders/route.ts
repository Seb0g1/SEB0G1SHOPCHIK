import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const taskStatus = url.searchParams.get("taskStatus") || undefined;
  return NextResponse.json({ orders: await listOrders({ status, taskStatus }) });
}
