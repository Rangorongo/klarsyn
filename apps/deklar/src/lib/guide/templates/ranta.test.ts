import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildRantaGuide } from "./ranta";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Skattereduktion för ränteutgifter",
    amountOre: 6_000_00,
    motivation: "30 % skattereduktion på ränteutgifter.",
    source: "Skatteverket — Skattereduktion för underskott av kapital",
    needsReview: false,
    ...overrides,
  };
}

describe("buildRantaGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildRantaGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildRantaGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildRantaGuide(result({ amountOre: 6_000_00 }));

    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(6_000_00))),
    ).toBe(true);
  });
});
