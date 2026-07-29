import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { kryptoRule } from "./krypto";

const underlag: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("kryptoRule.appliesTo", () => {
  test("is always a candidate — crypto sales aren't in Skatteverket's prefilled data", () => {
    expect(kryptoRule.appliesTo(underlag)).toBe(true);
  });
});

describe("kryptoRule.questions", () => {
  test("asks for sale proceeds and known cost basis, in kr", () => {
    const questions = kryptoRule.questions(underlag, {});
    expect(questions.map((q) => q.id)).toEqual([
      "forsaljningsprisKr",
      "kandOmkostnadsbeloppKr",
    ]);
  });
});

describe("kryptoRule.compute", () => {
  test("needs review when sale proceeds are missing", () => {
    const result = kryptoRule.compute(underlag, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("finds a tax saving when schablonmetoden beats an unknown/zero cost basis", () => {
    // Sale: 10,000 kr. Schablon cost basis = 20% = 2,000 kr = 200,000 öre.
    // No known actual cost basis => extra deduction 200,000 öre.
    // Tax saving at 30% kapitalskatt = 60,000 öre (600 kr).
    const result = kryptoRule.compute(underlag, {
      forsaljningsprisKr: 10_000,
    });
    expect(result).toMatchObject({ amountOre: 60_000, needsReview: false });
  });

  test("finds no extra saving when the known cost basis already beats schablonmetoden", () => {
    const result = kryptoRule.compute(underlag, {
      forsaljningsprisKr: 10_000,
      kandOmkostnadsbeloppKr: 3_000,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });
});
