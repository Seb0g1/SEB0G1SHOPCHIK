import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteTemplate, updateTemplate } from "@/lib/reviews";

const schema = z.object({
  name: z.string().min(1).optional(),
  ratingMin: z.coerce.number().int().min(1).max(5).optional(),
  ratingMax: z.coerce.number().int().min(1).max(5).optional(),
  keywords: z.string().optional(),
  text: z.string().min(1).optional(),
  priority: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template payload", details: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ template: await updateTemplate(id, parsed.data) });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json(await deleteTemplate(id));
}
