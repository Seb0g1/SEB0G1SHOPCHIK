import { NextResponse } from "next/server";
import { z } from "zod";
import { updateSupplierTask } from "@/lib/orders";

const schema = z.object({
  supplierId: z.string().nullable().optional(),
  generatedMessage: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid supplier task payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ task: await updateSupplierTask(id, parsed.data) });
}
