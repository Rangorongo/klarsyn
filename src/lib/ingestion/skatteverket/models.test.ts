import { describe, expect, test } from "vitest";
import { UnderlagSchema } from "./models";

describe("UnderlagSchema", () => {
  test("parses valid Underlag data", () => {
    const result = UnderlagSchema.parse({
      inkomstar: 2025,
      arbetsinkomstSummaOre: 35_000_00,
    });

    expect(result).toEqual({
      inkomstar: 2025,
      arbetsinkomstSummaOre: 35_000_00,
    });
  });

  test("rejects a negative arbetsinkomstSummaOre", () => {
    expect(() =>
      UnderlagSchema.parse({ inkomstar: 2025, arbetsinkomstSummaOre: -1 }),
    ).toThrow();
  });

  test("rejects a non-integer inkomstar", () => {
    expect(() =>
      UnderlagSchema.parse({ inkomstar: 2025.5, arbetsinkomstSummaOre: 0 }),
    ).toThrow();
  });
});
