import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildDubbelBosattningGuide } from "./dubbelBosattning";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Dubbel bosättning",
    amountOre: 2_474_000,
    motivation: "Ökade levnadskostnader, styrkt boendekostnad och hemresor.",
    source: "Skatteverket — Dubbel bosättning",
    needsReview: false,
    ...overrides,
  };
}

describe("buildDubbelBosattningGuide", () => {
  test("returns null when not applicable (amount is zero)", () => {
    expect(buildDubbelBosattningGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildDubbelBosattningGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildDubbelBosattningGuide(result({ amountOre: 2_474_000 }));

    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(2_474_000))),
    ).toBe(true);
  });
});
