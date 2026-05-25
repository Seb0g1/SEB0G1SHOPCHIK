import { NextResponse } from "next/server";
import { readUploadedFile } from "@/lib/storage";

export async function GET(_: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const file = await readUploadedFile(path);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const extension = file.localPath.split(".").pop()?.toLowerCase();
  const mimeType =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : "image/jpeg";

  return new Response(file.buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
