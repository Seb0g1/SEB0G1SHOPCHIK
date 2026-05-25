import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export function uploadRoot() {
  return UPLOAD_ROOT;
}

export async function saveUpload(productId: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = extensionFor(file.name, file.type);
  const dir = path.join(UPLOAD_ROOT, productId);
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}${extension}`;
  const localPath = path.join(dir, fileName);
  await writeFile(localPath, buffer);

  return {
    originalName: file.name || "upload",
    fileName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: buffer.length,
    localPath,
    publicUrl: `/api/uploads/${encodeURIComponent(productId)}/${encodeURIComponent(fileName)}`,
  };
}

export async function readUploadedFile(parts: string[]) {
  const [productId, fileName] = parts;
  if (!productId || !fileName) return null;

  const resolved = path.resolve(UPLOAD_ROOT, productId, fileName);
  const root = path.resolve(UPLOAD_ROOT);
  if (!resolved.startsWith(root)) return null;

  try {
    const info = await stat(resolved);
    if (!info.isFile()) return null;
    return { buffer: await readFile(resolved), localPath: resolved };
  } catch {
    return null;
  }
}

function extensionFor(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (/^\.[a-z0-9]{1,6}$/.test(ext)) return ext;
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return ".jpg";
}
