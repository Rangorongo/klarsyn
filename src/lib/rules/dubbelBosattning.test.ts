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

  test("asks for a description once the answer is yes", () => {
    const questions = dubbelBosattningRule.questions(underlag, {
      harDubbelBosattning: true,
    });
    expect(questions.map((q) => q.id)).toEqual([
      "harDubbelBosattning",
      "beskrivning",
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

  test("always needs manual review when answered yes — never a computed amount", () => {
    const result = dubbelBosattningRule.compute(underlag, {
      harDubbelBosattning: true,
    });
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });

  test("needs review when unanswered", () => {
    const result = dubbelBosattningRule.compute(underlag, {});
    expect(result).toMatchObject({ amountOre: null, needsReview: true });
  });
});
