import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { kapitalforlustRule } from "./kapitalforlust";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("kapitalforlustRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(kapitalforlustRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(kapitalforlustRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("kapitalforlustRule.questions", () => {
  test("asks only harKapitalforlust before it is answered", () => {
    const questions = kapitalforlustRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["harKapitalforlust"]);
  });

  test("branches to the full question set once the answer is yes", () => {
    const questions = kapitalforlustRule.questions(withIncome, {
      harKapitalforlust: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harKapitalforlust",
      "kapitalforlustKr",
      "kapitalvinstKr",
      "kapitalforlustRedanForifyllt",
    ]);
  });
});

describe("kapitalforlustRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = kapitalforlustRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when harKapitalforlust is false", () => {
    const result = kapitalforlustRule.compute(withIncome, {
      harKapitalforlust: false,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = kapitalforlustRule.compute(withIncome, {
      harKapitalforlust: true,
    });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("gains fully covering the loss leave nothing to quotient", () => {
    const result = kapitalforlustRule.compute(withIncome, {
      harKapitalforlust: true,
      kapitalforlustKr: 5_000,
      kapitalvinstKr: 5_000,
      kapitalforlustRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Inget att hitta");
  });

  test("zero when already prefilled", () => {
    const result = kapitalforlustRule.compute(withIncome, {
      harKapitalforlust: true,
      kapitalforlustKr: 10_000,
      kapitalvinstKr: 0,
      kapitalforlustRedanForifyllt: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("nets gains against losses, then quoters 70% and applies 30%", () => {
    // Net loss: 10,000 - 4,000 = 6,000 kr. Kvoterad: 70% = 4,200 kr.
    // Skattereduktion 30% (well under the 100,000 kr threshold) = 1,260 kr.
    const result = kapitalforlustRule.compute(withIncome, {
      harKapitalforlust: true,
      kapitalforlustKr: 10_000,
      kapitalvinstKr: 4_000,
      kapitalforlustRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 1_260_00, needsReview: false });
    expect(result.badge).toBe("Avdrag hittat");
  });

  test("applies the tiered 21% rate above the 100,000 kr combined threshold", () => {
    // No gains. Net loss 200,000 kr, kvoterad 70% = 140,000 kr.
    // 30% of 100,000 (30,000) + 21% of 40,000 (8,400) = 38,400 kr.
    const result = kapitalforlustRule.compute(withIncome, {
      harKapitalforlust: true,
      kapitalforlustKr: 200_000,
      kapitalvinstKr: 0,
      kapitalforlustRedanForifyllt: false,
    });
    expect(result).toMatchObject({ amountOre: 38_400_00, needsReview: false });
  });
});
