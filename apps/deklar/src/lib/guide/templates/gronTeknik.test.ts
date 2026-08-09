import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildGronTeknikGuide } from "./gronTeknik";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Grön teknik",
    amountOre: 15_000_00,
    motivation: "Du betalade fullt pris utan avdrag på fakturan.",
    source: "Skatteverket — Grön teknik",
    needsReview: false,
    ...overrides,
  };
}

describe("buildGronTeknikGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildGronTeknikGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildGronTeknikGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildGronTeknikGuide(result({ amountOre: 15_000_00 }));

    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(15_000_00))),
    ).toBe(true);
  });
});
