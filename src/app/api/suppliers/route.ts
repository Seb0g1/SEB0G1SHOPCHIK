import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupplier, listSuppliers } from "@/lib/suppliers";

const supplierSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  notes: z.string().optional(),
  defaultMessageTemplate: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({ suppliers: await listSuppliers({ includeInactive: true }) });
}

export async function POST(request: Request) {
  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid supplier payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const supplier = await createSupplier(parsed.data);
  return NextResponse.json({ supplier }, { status: 201 });
}
