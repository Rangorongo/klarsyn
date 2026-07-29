import { describe, expect, test } from "vitest";
import { SkatteverketParseError } from "./errors";
import { parseSkatteverketPdfText } from "./pdfParser";

describe("parseSkatteverketPdfText", () => {
  test("parses a single Kontant bruttolön line into öre", () => {
    const text = "Inkomstår: 2025\nKontant bruttolön: 350 000 kr\n";

    expect(parseSkatteverketPdfText(text)).toEqual({
      inkomstar: 2025,
      arbetsinkomstSummaOre: 35_000_000,
    });
  });

  test("sums multiple Kontant bruttolön lines (e.g. two employers)", () => {
    const text =
      "Inkomstår: 2025\nKontant bruttolön: 200 000 kr\nKontant bruttolön: 150 000 kr\n";

    expect(parseSkatteverketPdfText(text).arbetsinkomstSummaOre).toBe(
      35_000_000,
    );
  });

  test("treats no Kontant bruttolön line as zero employment income", () => {
    const text = "Inkomstår: 2025\n";

    expect(parseSkatteverketPdfText(text)).toEqual({
      inkomstar: 2025,
      arbetsinkomstSummaOre: 0,
    });
  });

  test("throws a clear SkatteverketParseError when Inkomstår is missing", () => {
    const text = "Kontant bruttolön: 350 000 kr\n";

    expect(() => parseSkatteverketPdfText(text)).toThrow(
      SkatteverketParseError,
    );
  });

  test("never leaks a personnummer present in the source text", () => {
    const text =
      "Inkomstår: 2025\nPersonnummer: 19900101-1234\nKontant bruttolön: 350 000 kr\n";

    const underlag = parseSkatteverketPdfText(text);
    expect(JSON.stringify(underlag)).not.toContain("19900101-1234");
  });
});
