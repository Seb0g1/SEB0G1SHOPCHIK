import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  return createHash("sha256")
    .update(process.env.SETTINGS_ENCRYPTION_KEY || "local-dev-avito-manager-key")
    .digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const [ivRaw, authTagRaw, encryptedRaw] = value.split(".");
    if (!ivRaw || !authTagRaw || !encryptedRaw) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
