import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { gavorRule } from "./gavor";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("gavorRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(gavorRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(gavorRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("gavorRule.questions", () => {
  test("asks only harSkanktGavor before it is answered", () => {
    const questions = gavorRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["harSkanktGavor"]);
  });

  test("branches to amount and prefilled questions once harSkanktGavor is true", () => {
    const questions = gavorRule.questions(withIncome, {
      harSkanktGavor: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harSkanktGavor",
      "gavobeloppKr",
      "gavorRedanForifyllt",
    ]);
  });
});

describe("gavorRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = gavorRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when harSkanktGavor is false", () => {
    const result = gavorRule.compute(withIncome, { harSkanktGavor: false });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = gavorRule.compute(withIncome, { harSkanktGavor: true });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("zero under the 2,000 kr annual minimum", () => {
    const result = gavorRule.compute(withIncome, {
      harSkanktGavor: true,
      gavobeloppKr: 1_500,
      gavorRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Under minimibeloppet");
  });

  test("zero when already prefilled", () => {
    const result = gavorRule.compute(withIncome, {
      harSkanktGavor: true,
      gavobeloppKr: 5_000,
      gavorRedanForifyllt: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("25% reduction on qualifying donations", () => {
    const result = gavorRule.compute(withIncome, {
      harSkanktGavor: true,
      gavobeloppKr: 5_000,
      gavorRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 1_250_00, needsReview: false });
  });

  test("caps the qualifying amount at 12,000 kr (max 3,000 kr reduction)", () => {
    const result = gavorRule.compute(withIncome, {
      harSkanktGavor: true,
      gavobeloppKr: 20_000,
      gavorRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 3_000_00, needsReview: false });
  });
});
