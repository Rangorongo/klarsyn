import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildGavorGuide } from "./gavor";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Skattereduktion för gåvor",
    amountOre: 1_250_00,
    motivation: "25 % skattereduktion på gåvor.",
    source: "Skatteverket — Skattereduktion för gåvor",
    needsReview: false,
    ...overrides,
  };
}

describe("buildGavorGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildGavorGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildGavorGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildGavorGuide(result({ amountOre: 1_250_00 }));

    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(1_250_00))),
    ).toBe(true);
  });
});
