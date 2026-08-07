import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildResorGuide } from "./resor";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Reseavdrag",
    amountOre: 900_000,
    motivation: "Dina resekostnader överstiger tröskelbeloppet.",
    source: "Skatteverket — Resor till och från arbetet",
    needsReview: false,
    ...overrides,
  };
}

describe("buildResorGuide", () => {
  test("returns null when there is nothing to file (amount is zero)", () => {
    expect(buildResorGuide(result({ amountOre: 0 }))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildResorGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });

  test("returns a full guide with the real computed amount when there is a deduction", () => {
    const guide = buildResorGuide(result({ amountOre: 900_000 }));

    expect(guide).not.toBeNull();
    expect(guide?.ruta).toMatch(/\d/);
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
    expect(guide?.steg.some((step) => step.includes(formatKr(900_000)))).toBe(
      true,
    );
  });
});
