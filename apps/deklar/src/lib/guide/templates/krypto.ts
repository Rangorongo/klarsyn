import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

// NOTE: reference is the standard section for other/unlisted assets on
// Bilaga K4 (avsnitt D) — unverified against a current Skatteverket
// blankett, same open question noted in rules/krypto.ts.
const RUTA = "Bilaga K4, avsnitt D — Övriga tillgångar";

export function buildKryptoGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: RUTA,
      dokumentationskrav: ["Transaktionshistorik från din/dina kryptobörser"],
      steg: [
        "Försäljningspris saknades för att kunna beräkna omkostnadsbeloppet — kontrollera manuellt mot din transaktionshistorik.",
      ],
    };
  }

  // A crypto sale must be reported on K4 regardless of whether
  // schablonmetoden actually beat the user's own known cost basis — only
  // the recommended omkostnadsbelopp differs.
  const usedSchablon = (result.amountOre ?? 0) > 0;

  return {
    ruta: RUTA,
    dokumentationskrav: [
      "Transaktionshistorik från din/dina kryptobörser",
      "Eventuellt underlag för din faktiska anskaffningsutgift",
    ],
    steg: usedSchablon
      ? [
          `Fyll i din försäljning på ${RUTA}.`,
          `Använd schablonmetoden (20 % av försäljningspriset) som omkostnadsbelopp — det ger dig en skattebesparing på ${formatKr(result.amountOre ?? 0)} jämfört med din kända anskaffningsutgift.`,
        ]
      : [
          `Fyll i din försäljning på ${RUTA}.`,
          "Använd din faktiska anskaffningsutgift som omkostnadsbelopp — den är redan minst lika hög som schablonmetodens 20 %.",
        ],
  };
}
