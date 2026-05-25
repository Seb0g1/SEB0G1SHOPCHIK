import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDraftForReview, saveReviewDraft } from "@/lib/reviews";

const schema = z.object({
  text: z.string().optional(),
  templateId: z.string().nullable().optional(),
  regenerate: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.text !== undefined) {
    return NextResponse.json({
      draft: await saveReviewDraft(id, { text: parsed.data.text, templateId: parsed.data.templateId }),
    });
  }

  const draft = await ensureDraftForReview(id, { regenerate: parsed.data.regenerate });
  if (!draft) return NextResponse.json({ error: "Draft cannot be created" }, { status: 404 });
  return NextResponse.json(draft);
}
