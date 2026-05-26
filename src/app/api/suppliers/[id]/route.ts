import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteSupplier, getSupplier, updateSupplier } from "@/lib/suppliers";

const supplierSchema = z.object({
  name: z.string().min(2).optional(),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  notes: z.string().optional(),
  defaultMessageTemplate: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supplier = await getSupplier(id);
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  return NextResponse.json({ supplier });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid supplier payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const supplier = await updateSupplier(id, parsed.data);
  return NextResponse.json({ supplier });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json(await deleteSupplier(id));
}
