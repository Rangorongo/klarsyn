import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildUthyrningGuide } from "./uthyrning";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Uthyrning av privatbostad",
    amountOre: 1_380_000,
    motivation: "40 000 kr schablonavdrag plus egen avgift/hyra.",
    source: "Skatteverket — Uthyrning av privatbostad",
    needsReview: false,
    ...overrides,
  };
}

describe("buildUthyrningGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildUthyrningGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildUthyrningGuide(
      result({ amountOre: null, needsReview: true }),
    );
    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildUthyrningGuide(result({ amountOre: 1_380_000 }));
    expect(guide).not.toBeNull();
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(
      guide?.steg.some((step) => step.includes(formatKr(1_380_000))),
    ).toBe(true);
  });
});
