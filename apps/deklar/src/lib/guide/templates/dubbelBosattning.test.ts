import { describe, expect, test } from "vitest";
import type { RuleResult } from "@/lib/rules/types";
import { buildDubbelBosattningGuide } from "./dubbelBosattning";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Ej aktuell",
    title: "Dubbel bosättning",
    amountOre: 0,
    motivation: "Du har uppgett att dubbel bosättning inte gäller dig.",
    source: "Skatteverket — Dubbel bosättning",
    needsReview: false,
    ...overrides,
  };
}

describe("buildDubbelBosattningGuide", () => {
  test("returns null when not applicable", () => {
    expect(buildDubbelBosattningGuide(result({}))).toBeNull();
  });

  test("returns a manual-review guide when needsReview is true — never a computed amount", () => {
    const guide = buildDubbelBosattningGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera|handläggare/i);
    expect(guide?.dokumentationskrav.length).toBeGreaterThan(0);
  });
});
