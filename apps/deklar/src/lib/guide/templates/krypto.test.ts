import { describe, expect, test } from "vitest";
import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import { buildKryptoGuide } from "./krypto";

function result(overrides: Partial<RuleResult>): RuleResult {
  return {
    badge: "Avdrag hittat",
    title: "Krypto — schablonmetoden",
    amountOre: 60_000,
    motivation: "Schablonmetoden ger ett högre omkostnadsbelopp.",
    source: "Skatteverket — Schablonmetoden för kryptovaluta",
    needsReview: false,
    ...overrides,
  };
}

describe("buildKryptoGuide", () => {
  test("always requires filing K4 when a sale was reported, even with no extra saving", () => {
    const guide = buildKryptoGuide(result({ amountOre: 0 }));

    expect(guide).not.toBeNull();
    expect(guide?.ruta).toMatch(/K4/);
    expect(guide?.steg.join(" ")).toMatch(/K4/);
  });

  test("recommends schablonmetoden explicitly when it found a saving", () => {
    const guide = buildKryptoGuide(result({ amountOre: 60_000 }));

    expect(guide?.steg.join(" ")).toMatch(/schablonmetoden/i);
    expect(guide?.steg.some((step) => step.includes(formatKr(60_000)))).toBe(
      true,
    );
  });

  test("returns a manual-review guide when needsReview is true", () => {
    const guide = buildKryptoGuide(
      result({ amountOre: null, needsReview: true }),
    );

    expect(guide).not.toBeNull();
    expect(guide?.steg.join(" ")).toMatch(/manuellt|kontrollera/i);
  });
});
