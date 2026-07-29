import { describe, expect, test } from "vitest";
import type { RuleResult } from "@/lib/rules/types";
import { generateGuide } from "./generate";

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

describe("generateGuide", () => {
  test("dispatches to the resor template", () => {
    const guide = generateGuide("resor", result({}));
    expect(guide?.ruta).toMatch(/Resor/);
  });

  test("dispatches to the dubbelBosattning template", () => {
    const guide = generateGuide(
      "dubbelBosattning",
      result({ amountOre: null, needsReview: true }),
    );
    expect(guide?.ruta).toMatch(/bosättning/);
  });

  test("dispatches to the krypto template", () => {
    const guide = generateGuide("krypto", result({}));
    expect(guide?.ruta).toMatch(/K4/);
  });

  test("returns null for an unknown ruleId", () => {
    expect(generateGuide("okand-regel", result({}))).toBeNull();
  });
});
