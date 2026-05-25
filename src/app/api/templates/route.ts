import { NextResponse } from "next/server";
import { z } from "zod";
import { createTemplate, listTemplates } from "@/lib/reviews";

const schema = z.object({
  name: z.string().min(1),
  ratingMin: z.coerce.number().int().min(1).max(5),
  ratingMax: z.coerce.number().int().min(1).max(5),
  keywords: z.string().optional(),
  text: z.string().min(1),
  priority: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({ templates: await listTemplates() });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template payload", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.ratingMin > parsed.data.ratingMax) {
    return NextResponse.json({ error: "ratingMin must be less than ratingMax" }, { status: 400 });
  }
  return NextResponse.json({ template: await createTemplate(parsed.data) }, { status: 201 });
}
