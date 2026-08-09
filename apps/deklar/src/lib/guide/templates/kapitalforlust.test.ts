import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildKapitalforlustGuide } from "./kapitalforlust";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Kapitalförlust — aktier och fonder",
    amountOre: 1_260_00,
    motivation: "70 % av din nettoförlust är avdragsgill.",
    source: "Skatteverket — Kvittning och kvotering",
    needsReview: false,
    ...overrides,
  };
}

describe("buildKapitalforlustGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildKapitalforlustGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildKapitalforlustGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildKapitalforlustGuide(result({ amountOre: 1_260_00 }));

    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(1_260_00))),
    ).toBe(true);
  });
});
