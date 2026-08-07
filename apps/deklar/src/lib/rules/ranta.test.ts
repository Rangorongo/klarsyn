import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { rantaRule } from "./ranta";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("rantaRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(rantaRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(rantaRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("rantaRule.questions", () => {
  test("asks only harRanteutgifter before it is answered", () => {
    const questions = rantaRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["harRanteutgifter"]);
  });

  test("branches to amount and prefilled questions once harRanteutgifter is true", () => {
    const questions = rantaRule.questions(withIncome, {
      harRanteutgifter: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harRanteutgifter",
      "ranteutgifterKr",
      "ranteRedanForifyllt",
    ]);
  });
});

describe("rantaRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = rantaRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when harRanteutgifter is false", () => {
    const result = rantaRule.compute(withIncome, { harRanteutgifter: false });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = rantaRule.compute(withIncome, { harRanteutgifter: true });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("zero when already prefilled", () => {
    const result = rantaRule.compute(withIncome, {
      harRanteutgifter: true,
      ranteutgifterKr: 20_000,
      ranteRedanForifyllt: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("30% below the 100,000 kr threshold", () => {
    const result = rantaRule.compute(withIncome, {
      harRanteutgifter: true,
      ranteutgifterKr: 20_000,
      ranteRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 6_000_00, needsReview: false });
  });

  test("30% up to 100,000 kr plus 21% above it", () => {
    // 130,000 kr: 30% of 100,000 (30,000) + 21% of 30,000 (6,300) = 36,300 kr
    const result = rantaRule.compute(withIncome, {
      harRanteutgifter: true,
      ranteutgifterKr: 130_000,
      ranteRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 36_300_00, needsReview: false });
  });
});
