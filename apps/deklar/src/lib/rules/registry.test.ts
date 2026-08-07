import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { RuleRegistry } from "./registry";
import type { Rule } from "./types";

const underlag: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 0 };

function stubRule(id: string, applies: boolean): Rule {
  return {
    id,
    appliesTo: () => applies,
    questions: () => [],
    compute: () => ({
      badge: "",
      title: "",
      amountOre: 0,
      motivation: "",
      source: "",
      needsReview: false,
    }),
  };
}

describe("RuleRegistry", () => {
  test("getApplicable returns only rules whose appliesTo matches", () => {
    const registry = new RuleRegistry();
    registry.register(stubRule("applicable", true));
    registry.register(stubRule("not-applicable", false));

    const result = registry.getApplicable(underlag);

    expect(result.map((rule) => rule.id)).toEqual(["applicable"]);
  });

  test("getApplicable returns an empty array when no rules are registered", () => {
    const registry = new RuleRegistry();

    expect(registry.getApplicable(underlag)).toEqual([]);
  });
});
