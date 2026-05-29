import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const algorithm = "aes-256-gcm";

function getEncryptionKey() {
  const secret = process.env.OZON_API_KEY_ENCRYPTION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OZON_API_KEY_ENCRYPTION_SECRET is required in production.");
  }

  return createHash("sha256").update(secret || "dev-only-ozon-api-key-secret").digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string) {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !tagHex || !encryptedHex) throw new Error("Invalid encrypted payload.");

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function maskSecret(value: string) {
  if (!value) return "未设置";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
