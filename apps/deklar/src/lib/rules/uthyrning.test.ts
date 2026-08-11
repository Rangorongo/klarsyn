import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { uthyrningRule } from "./uthyrning";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("uthyrningRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(uthyrningRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(uthyrningRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("uthyrningRule.questions", () => {
  test("asks only harHyrtUt before it is answered", () => {
    const questions = uthyrningRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["harHyrtUt"]);
  });

  test("branches to the full question set once the answer is yes", () => {
    const questions = uthyrningRule.questions(withIncome, { harHyrtUt: true });
    expect(questions.map((q) => q.id)).toEqual([
      "harHyrtUt",
      "hyresintaktKr",
      "uthyrningBostadstyp",
      "uthyrningFaktiskKostnadKr",
      "uthyrningRedanRedovisat",
    ]);
  });
});

describe("uthyrningRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = uthyrningRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when harHyrtUt is false", () => {
    const result = uthyrningRule.compute(withIncome, { harHyrtUt: false });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = uthyrningRule.compute(withIncome, { harHyrtUt: true });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("zero when already redovisat", () => {
    const result = uthyrningRule.compute(withIncome, {
      harHyrtUt: true,
      hyresintaktKr: 60_000,
      uthyrningBostadstyp: "bostadsratt",
      uthyrningFaktiskKostnadKr: 6_000,
      uthyrningRedanRedovisat: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Redan hanterat");
  });

  test("computes 30% of schablon + egen avgift, under the income cap", () => {
    // Avdrag: 40,000 + 6,000 = 46,000 kr. 30% = 13,800 kr.
    const result = uthyrningRule.compute(withIncome, {
      harHyrtUt: true,
      hyresintaktKr: 60_000,
      uthyrningBostadstyp: "bostadsratt",
      uthyrningFaktiskKostnadKr: 6_000,
      uthyrningRedanRedovisat: false,
    });
    expect(result).toMatchObject({ amountOre: 1_380_000, needsReview: false });
  });

  test("caps the deduction at the rental income itself", () => {
    // Avdrag would be 40,000 + 2,000 = 42,000 kr, but income is only 30,000 kr.
    // 30% of 30,000 kr = 9,000 kr.
    const result = uthyrningRule.compute(withIncome, {
      harHyrtUt: true,
      hyresintaktKr: 30_000,
      uthyrningBostadstyp: "hyresratt",
      uthyrningFaktiskKostnadKr: 2_000,
      uthyrningRedanRedovisat: false,
    });
    expect(result).toMatchObject({ amountOre: 900_000, needsReview: false });
  });
});
