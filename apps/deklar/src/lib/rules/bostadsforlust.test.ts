import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { bostadsforlustRule } from "./bostadsforlust";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("bostadsforlustRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(bostadsforlustRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(bostadsforlustRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("bostadsforlustRule.questions", () => {
  test("asks only harSaltBostadMedForlust before it is answered", () => {
    const questions = bostadsforlustRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["harSaltBostadMedForlust"]);
  });

  test("branches to the full question set once the answer is yes", () => {
    const questions = bostadsforlustRule.questions(withIncome, {
      harSaltBostadMedForlust: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harSaltBostadMedForlust",
      "bostadsforlustKr",
      "oaktaBostadsratt",
      "bostadsforlustRedanForifyllt",
    ]);
  });
});

describe("bostadsforlustRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = bostadsforlustRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when harSaltBostadMedForlust is false", () => {
    const result = bostadsforlustRule.compute(withIncome, {
      harSaltBostadMedForlust: false,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = bostadsforlustRule.compute(withIncome, {
      harSaltBostadMedForlust: true,
    });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("zero when already prefilled", () => {
    const result = bostadsforlustRule.compute(withIncome, {
      harSaltBostadMedForlust: true,
      bostadsforlustKr: 100_000,
      oaktaBostadsratt: false,
      bostadsforlustRedanForifyllt: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("äkta bostad: 50% kvotering then tiered skattereduktion", () => {
    // Förlust 100,000 kr, kvoterad 50% = 50,000 kr. 30% (under tröskeln) = 15,000 kr.
    const result = bostadsforlustRule.compute(withIncome, {
      harSaltBostadMedForlust: true,
      bostadsforlustKr: 100_000,
      oaktaBostadsratt: false,
      bostadsforlustRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 1_500_000, needsReview: false });
  });

  test("oäkta bostadsrätt: 63% kvotering", () => {
    // Förlust 100,000 kr, kvoterad 63% = 63,000 kr. 30% = 18,900 kr.
    const result = bostadsforlustRule.compute(withIncome, {
      harSaltBostadMedForlust: true,
      bostadsforlustKr: 100_000,
      oaktaBostadsratt: true,
      bostadsforlustRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 1_890_000, needsReview: false });
  });
});
