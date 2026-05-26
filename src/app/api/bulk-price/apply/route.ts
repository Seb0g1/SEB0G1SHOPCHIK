import { NextResponse } from "next/server";
import { z } from "zod";
import { applyBulkPrice } from "@/lib/bulk-price";

const schema = z.object({
  productIds: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  mode: z.enum(["SET", "ADD", "PERCENT"]),
  value: z.coerce.number(),
  rounding: z.enum(["NONE", "TO_9", "TO_99"]).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk price payload", details: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(await applyBulkPrice(parsed.data));
}
