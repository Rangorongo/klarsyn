import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { RuleRegistry } from "@/lib/rules/registry";
import { resorRule } from "@/lib/rules/resor";
import { dubbelBosattningRule } from "@/lib/rules/dubbelBosattning";
import { getNextQuestion } from "./engine";

function buildRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.register(resorRule);
  registry.register(dubbelBosattningRule);
  return registry;
}

const underlagWithIncome: Underlag = {
  inkomstar: 2025,
  arbetsinkomstSummaOre: 1,
};

describe("getNextQuestion", () => {
  test("asks the first applicable rule's first question when nothing is answered", () => {
    const result = getNextQuestion(buildRegistry(), underlagWithIncome, {});

    expect(result.ruleId).toBe("resor");
    expect(result.question?.id).toBe("fardmedel");
    expect(result.answeredCount).toBe(0);
    // resor.fardmedel (1) + dubbelBosattning.harDubbelBosattning (1)
    expect(result.totalCount).toBe(2);
  });

  test("progress denominator grows once a branching answer expands the question set", () => {
    const result = getNextQuestion(buildRegistry(), underlagWithIncome, {
      fardmedel: "bil",
    });

    // resor: fardmedel + avstandKm + spararTid + arbetsdagarPerAr (4) + dubbelBosattning: harDubbelBosattning (1)
    expect(result.totalCount).toBe(5);
    expect(result.answeredCount).toBe(1);
    expect(result.ruleId).toBe("resor");
    expect(result.question?.id).toBe("avstandKm");
  });

  test("moves to the next rule once the current rule's questions are all answered", () => {
    const result = getNextQuestion(buildRegistry(), underlagWithIncome, {
      fardmedel: "bil",
      avstandKm: 20,
      spararTid: true,
      arbetsdagarPerAr: 200,
    });

    expect(result.ruleId).toBe("dubbelBosattning");
    expect(result.question?.id).toBe("harDubbelBosattning");
  });

  test("returns a null question once every applicable question is answered, including explicit false answers", () => {
    const result = getNextQuestion(buildRegistry(), underlagWithIncome, {
      fardmedel: "bil",
      avstandKm: 20,
      spararTid: true,
      arbetsdagarPerAr: 200,
      harDubbelBosattning: false,
    });

    expect(result.question).toBeNull();
    expect(result.ruleId).toBeNull();
    expect(result.answeredCount).toBe(result.totalCount);
  });

  test("returns no question and zero total when no rules apply", () => {
    const noIncome: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };
    const registry = new RuleRegistry();
    registry.register(resorRule); // the only rule; doesn't apply without income

    const result = getNextQuestion(registry, noIncome, {});

    expect(result).toEqual({
      question: null,
      ruleId: null,
      answeredCount: 0,
      totalCount: 0,
    });
  });
});
