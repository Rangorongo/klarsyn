import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { dubbelBosattningRule } from "./dubbelBosattning";

const underlag: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

describe("dubbelBosattningRule.appliesTo", () => {
  test("is always a candidate — Underlag alone can't rule it out", () => {
    expect(dubbelBosattningRule.appliesTo(underlag)).toBe(true);
    expect(
      dubbelBosattningRule.appliesTo({
        inkomstar: 2025,
        arbetsinkomstSummaOre: 1,
      }),
    ).toBe(true);
  });
});

describe("dubbelBosattningRule.questions", () => {
  test("asks only the yes/no question before it is answered", () => {
    const questions = dubbelBosattningRule.questions(underlag, {});
    expect(questions.map((q) => q.id)).toEqual(["harDubbelBosattning"]);
  });

  test("branches to the full question set once the answer is yes", () => {
    const questions = dubbelBosattningRule.questions(underlag, {
      harDubbelBosattning: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harDubbelBosattning",
      "dubbelBosattningAvstandKm",
      "dagarForstaManaden",
      "logikostnadKr",
      "hemresorAntal",
      "hemresaKostnadKr",
    ]);
  });

  test("stops after distance once under the 50km minimum — no need for the rest", () => {
    const questions = dubbelBosattningRule.questions(underlag, {
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 20,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harDubbelBosattning",
      "dubbelBosattningAvstandKm",
    ]);
  });
});

describe("dubbelBosattningRule.compute", () => {
  test("is not applicable and needs no review when answered no", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: false,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
  });

  test("needs review when unanswered", () => {
    const result = dubbelBosattningRule.compute(underlag, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("needs review when distance is missing", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
    });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("disqualified under the 50km minimum", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 49,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Uppfyller inte kraven");
  });

  test("needs review when follow-up answers are missing past the distance check", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 80,
    });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("computes levnadskostnad + logi + hemresor", () => {
    // 20 dagar * 87 kr = 1,740 kr levnadskostnad
    // 15,000 kr logi
    // 10 hemresor * 800 kr = 8,000 kr
    // total = 24,740 kr = 2,474,000 öre
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 80,
      dagarForstaManaden: 20,
      logikostnadKr: 15_000,
      hemresorAntal: 10,
      hemresaKostnadKr: 800,
    });
    expect(result).toMatchObject({ amountOre: 2_474_000, needsReview: false });
    expect(result.badge).toBe("Avdrag hittat");
  });

  test("caps the schablon days at 30 even if more are entered", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 80,
      dagarForstaManaden: 45,
      logikostnadKr: 0,
      hemresorAntal: 0,
      hemresaKostnadKr: 0,
    });
    // 30 * 87 kr = 2,610 kr = 261,000 öre
    expect(result).toMatchObject({ amountOre: 261_000, needsReview: false });
  });

  test("gives zero when every cost is zero", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 80,
      dagarForstaManaden: 0,
      logikostnadKr: 0,
      hemresorAntal: 0,
      hemresaKostnadKr: 0,
    });
    expect(result).toMatchObject({ amountOre: 0, needsReview: false });
    expect(result.badge).toBe("Inget att hitta");
  });
});
