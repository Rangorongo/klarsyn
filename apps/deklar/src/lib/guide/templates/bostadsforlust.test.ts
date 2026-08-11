import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildBostadsforlustGuide } from "./bostadsforlust";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Förlust vid bostadsförsäljning",
    amountOre: 1_500_000,
    motivation: "50 % av förlusten är avdragsgill.",
    source: "Skatteverket — Försäljning av bostad",
    needsReview: false,
    ...overrides,
  };
}

describe("buildBostadsforlustGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildBostadsforlustGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildBostadsforlustGuide(
      result({ amountOre: null, needsReview: true }),
    );
    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildBostadsforlustGuide(result({ amountOre: 1_500_000 }));
    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(1_500_000))),
    ).toBe(true);
  });
});
