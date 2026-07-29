import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit IV, recommended size for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

export interface EncryptedPayload {
  ciphertext: string; // base64, includes the GCM auth tag
  iv: string; // base64
}

function getMasterKey(): Buffer {
  const base64Key = process.env.ENCRYPTION_MASTER_KEY;
  if (!base64Key) {
    throw new Error("ENCRYPTION_MASTER_KEY saknas i miljövariablerna.");
  }

  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY måste vara 32 bytes (base64-kodad).",
    );
  }

  return key;
}

// AES-256-GCM blob-level encryption for Underlag/AnswerSet/uploaded files,
// matching the ciphertext + encryptionIv column pairs in prisma/schema.prisma.
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getMasterKey();
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");

  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH_BYTES);
  const encrypted = combined.subarray(
    0,
    combined.length - AUTH_TAG_LENGTH_BYTES,
  );

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
