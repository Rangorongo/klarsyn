import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { decrypt, encrypt } from "./encryption";

const TEST_KEY = "DtxWAAwopBRJJ9wLg/hHn8/BRd71aFr/1Cvg59ONsyE=";
const ORIGINAL_ENV = process.env.ENCRYPTION_MASTER_KEY;

beforeEach(() => {
  process.env.ENCRYPTION_MASTER_KEY = TEST_KEY;
});

afterEach(() => {
  process.env.ENCRYPTION_MASTER_KEY = ORIGINAL_ENV;
});

describe("encrypt/decrypt", () => {
  test("round-trips a plaintext string", () => {
    const payload = encrypt("hemlig text med åäö");
    expect(decrypt(payload)).toBe("hemlig text med åäö");
  });

  test("uses a different IV (and ciphertext) on every call for the same plaintext", () => {
    const a = encrypt("samma text");
    const b = encrypt("samma text");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  test("throws when the ciphertext has been tampered with (GCM auth tag check)", () => {
    const payload = encrypt("hemlig text");
    const tampered = {
      ...payload,
      ciphertext: Buffer.from("tampered garbage data here!!").toString(
        "base64",
      ),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  test("throws a clear error when ENCRYPTION_MASTER_KEY is missing", () => {
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(() => encrypt("text")).toThrow(/ENCRYPTION_MASTER_KEY/);
  });

  test("throws a clear error when ENCRYPTION_MASTER_KEY isn't a valid 32-byte key", () => {
    process.env.ENCRYPTION_MASTER_KEY =
      Buffer.from("too short").toString("base64");
    expect(() => encrypt("text")).toThrow(/32 bytes/);
  });
});
