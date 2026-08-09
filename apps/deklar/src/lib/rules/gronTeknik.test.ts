import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { gronTeknikRule } from "./gronTeknik";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("gronTeknikRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(gronTeknikRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(gronTeknikRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("gronTeknikRule.questions", () => {
  test("asks only gronTeknikAnvant before it is answered", () => {
    const questions = gronTeknikRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["gronTeknikAnvant"]);
  });

  test("branches to the full question set once the answer is yes", () => {
    const questions = gronTeknikRule.questions(withIncome, {
      gronTeknikAnvant: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "gronTeknikAnvant",
      "solcellerKostnadKr",
      "lagringKostnadKr",
      "laddningKostnadKr",
      "gronTeknikAvdragetTillampat",
    ]);
  });
});

describe("gronTeknikRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = gronTeknikRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when gronTeknikAnvant is false", () => {
    const result = gronTeknikRule.compute(withIncome, {
      gronTeknikAnvant: false,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = gronTeknikRule.compute(withIncome, {
      gronTeknikAnvant: true,
    });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("zero (informational) when the deduction was already applied at invoice time", () => {
    const result = gronTeknikRule.compute(withIncome, {
      gronTeknikAnvant: true,
      solcellerKostnadKr: 100_000,
      lagringKostnadKr: 0,
      laddningKostnadKr: 0,
      gronTeknikAvdragetTillampat: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Redan hanterat");
  });

  test("computes 15% for solceller when not yet applied", () => {
    const result = gronTeknikRule.compute(withIncome, {
      gronTeknikAnvant: true,
      solcellerKostnadKr: 100_000,
      lagringKostnadKr: 0,
      laddningKostnadKr: 0,
      gronTeknikAvdragetTillampat: false,
    });
    expect(result).toMatchObject({ amountOre: 15_000_00, needsReview: false });
  });

  test("computes 50% for lagring and laddning combined", () => {
    const result = gronTeknikRule.compute(withIncome, {
      gronTeknikAnvant: true,
      solcellerKostnadKr: 0,
      lagringKostnadKr: 20_000,
      laddningKostnadKr: 10_000,
      gronTeknikAvdragetTillampat: false,
    });
    // 50% of 20,000 + 50% of 10,000 = 15,000 kr
    expect(result).toMatchObject({ amountOre: 15_000_00, needsReview: false });
  });

  test("caps the combined reduction at 50,000 kr", () => {
    const result = gronTeknikRule.compute(withIncome, {
      gronTeknikAnvant: true,
      solcellerKostnadKr: 400_000, // 15% = 60,000
      lagringKostnadKr: 0,
      laddningKostnadKr: 0,
      gronTeknikAvdragetTillampat: false,
    });
    expect(result).toMatchObject({ amountOre: 50_000_00, needsReview: false });
  });
});
