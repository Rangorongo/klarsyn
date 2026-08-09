import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { resorRule } from "./resor";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("resorRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(resorRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(resorRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("resorRule.questions", () => {
  test("asks only for färdmedel before it is answered", () => {
    const questions = resorRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["fardmedel"]);
  });

  test("färdmedel is a fixed choice between bil and kollektivt", () => {
    const [fardmedel] = resorRule.questions(withIncome, {});
    expect(fardmedel.options).toEqual(["bil", "kollektivt"]);
  });

  test("branches to car questions once färdmedel is bil", () => {
    const questions = resorRule.questions(withIncome, { fardmedel: "bil" });
    expect(questions.map((q) => q.id)).toEqual([
      "fardmedel",
      "avstandKm",
      "arbetsdagarPerAr",
    ]);
  });

  test("branches to public transport question once färdmedel is kollektivt", () => {
    const questions = resorRule.questions(withIncome, {
      fardmedel: "kollektivt",
    });
    expect(questions.map((q) => q.id)).toEqual([
      "fardmedel",
      "kollektivtKostnadKr",
    ]);
  });
});

describe("resorRule.compute — bil", () => {
  test("needs review when required car answers are missing", () => {
    const result = resorRule.compute(withIncome, { fardmedel: "bil" });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("gives no deduction under the 5km minimum", () => {
    const result = resorRule.compute(withIncome, {
      fardmedel: "bil",
      avstandKm: 4,
      arbetsdagarPerAr: 200,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("computes the deduction above the threshold", () => {
    // 20km one-way * 2 * 200 days = 8000km = 800 mil * 25 kr/mil = 20,000 kr
    // minus the 11,000 kr threshold = 9,000 kr => 900,000 öre
    const result = resorRule.compute(withIncome, {
      fardmedel: "bil",
      avstandKm: 20,
      arbetsdagarPerAr: 200,
    });
    expect(result).toMatchObject({
      amountOre: 900_000,
      needsReview: false,
    });
  });

  test("gives zero when total cost is under the threshold", () => {
    // 5km one-way * 2 * 50 days = 500km = 50 mil * 25 kr/mil = 1,250 kr < threshold
    const result = resorRule.compute(withIncome, {
      fardmedel: "bil",
      avstandKm: 5,
      arbetsdagarPerAr: 50,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });
});

describe("resorRule.compute — kollektivt", () => {
  test("needs review when the cost answer is missing", () => {
    const result = resorRule.compute(withIncome, { fardmedel: "kollektivt" });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("computes deduction above the threshold", () => {
    const result = resorRule.compute(withIncome, {
      fardmedel: "kollektivt",
      kollektivtKostnadKr: 15_000,
    });
    expect(result).toMatchObject({ amountOre: 4_000_00, needsReview: false });
  });

  test("gives zero under the threshold", () => {
    const result = resorRule.compute(withIncome, {
      fardmedel: "kollektivt",
      kollektivtKostnadKr: 5_000,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });
});

describe("resorRule.compute — no färdmedel answered", () => {
  test("needs review", () => {
    const result = resorRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });
});
