import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonList } from "@/lib/serializers";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.publicationRun.findFirst({
    where: { productId: id },
    orderBy: { submittedAt: "desc" },
  });

  if (!run) return NextResponse.json({ report: null });

  return NextResponse.json({
    report: {
      id: run.id,
      status: run.status,
      feedVersion: run.feedVersion,
      submittedAt: run.submittedAt.toISOString(),
      reportStatus: run.reportStatus,
      errors: parseJsonList(run.errorsJson),
      warnings: parseJsonList(run.warningsJson),
      rawReport: run.rawReport,
    },
  });
}
