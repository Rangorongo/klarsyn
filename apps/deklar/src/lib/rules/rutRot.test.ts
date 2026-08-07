import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { rutRotRule } from "./rutRot";

const withIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };
const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("rutRotRule.appliesTo", () => {
  test("applies when Underlag has employment income", () => {
    expect(rutRotRule.appliesTo(withIncome)).toBe(true);
  });

  test("does not apply when Underlag has no employment income", () => {
    expect(rutRotRule.appliesTo(noIncome)).toBe(false);
  });
});

describe("rutRotRule.questions", () => {
  test("asks only rutRotAnvant before it is answered", () => {
    const questions = rutRotRule.questions(withIncome, {});
    expect(questions.map((q) => q.id)).toEqual(["rutRotAnvant"]);
  });

  test("branches to cost and applied questions once rutRotAnvant is true", () => {
    const questions = rutRotRule.questions(withIncome, { rutRotAnvant: true });
    expect(questions.map((q) => q.id)).toEqual([
      "rutRotAnvant",
      "rutArbetskostnadKr",
      "rotArbetskostnadKr",
      "rutRotAvdragetTillampat",
    ]);
  });
});

describe("rutRotRule.compute", () => {
  test("needs review when unanswered", () => {
    const result = rutRotRule.compute(withIncome, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("not applicable when rutRotAnvant is false", () => {
    const result = rutRotRule.compute(withIncome, { rutRotAnvant: false });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when follow-up answers are missing", () => {
    const result = rutRotRule.compute(withIncome, { rutRotAnvant: true });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("zero (informational) when the deduction was already applied at invoice time", () => {
    const result = rutRotRule.compute(withIncome, {
      rutRotAnvant: true,
      rutArbetskostnadKr: 10_000,
      rotArbetskostnadKr: 0,
      rutRotAvdragetTillampat: true,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Redan hanterat");
  });

  test("computes 50% RUT when not yet applied", () => {
    const result = rutRotRule.compute(withIncome, {
      rutRotAnvant: true,
      rutArbetskostnadKr: 10_000,
      rotArbetskostnadKr: 0,
      rutRotAvdragetTillampat: false,
    });
    expect(result).toMatchObject({ amountOre: 5_000_00, needsReview: false });
  });

  test("computes 30% ROT capped at 50,000 kr", () => {
    const result = rutRotRule.compute(withIncome, {
      rutRotAnvant: true,
      rutArbetskostnadKr: 0,
      rotArbetskostnadKr: 200_000,
      rutRotAvdragetTillampat: false,
    });
    // 30% of 200,000 = 60,000, but ROT is capped at 50,000
    expect(result).toMatchObject({ amountOre: 50_000_00, needsReview: false });
  });

  test("caps the combined RUT+ROT reduction at 75,000 kr", () => {
    const result = rutRotRule.compute(withIncome, {
      rutRotAnvant: true,
      rutArbetskostnadKr: 100_000, // 50,000 kr reduction
      rotArbetskostnadKr: 200_000, // capped at 50,000 kr reduction
      rutRotAvdragetTillampat: false,
    });
    expect(result).toMatchObject({ amountOre: 75_000_00, needsReview: false });
  });
});
