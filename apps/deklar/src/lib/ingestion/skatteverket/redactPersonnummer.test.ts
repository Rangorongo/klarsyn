import { describe, expect, test } from "vitest";
import { redactPersonnummer } from "./redactPersonnummer";

describe("redactPersonnummer", () => {
  test("redacts a 12-digit personnummer with dash", () => {
    expect(redactPersonnummer("19900101-1234")).toBe("[REDACTED]");
  });

  test("redacts a 10-digit personnummer with dash", () => {
    expect(redactPersonnummer("900101-1234")).toBe("[REDACTED]");
  });

  test("redacts a samordningsnummer with plus sign", () => {
    expect(redactPersonnummer("900101+1234")).toBe("[REDACTED]");
  });

  test("redacts a personnummer with no separator", () => {
    expect(redactPersonnummer("199001011234")).toBe("[REDACTED]");
  });

  test("redacts multiple occurrences and preserves surrounding text", () => {
    const input =
      "Personnummer: 19900101-1234, make/maka: 19850505-5678, inkomst 350000";
    expect(redactPersonnummer(input)).toBe(
      "Personnummer: [REDACTED], make/maka: [REDACTED], inkomst 350000",
    );
  });

  test("leaves a plain SEK amount untouched", () => {
    expect(redactPersonnummer("Kontant bruttolön: 350000 kr")).toBe(
      "Kontant bruttolön: 350000 kr",
    );
  });

  test("leaves a bare year untouched", () => {
    expect(redactPersonnummer("Inkomstår: 2025")).toBe("Inkomstår: 2025");
  });
});
