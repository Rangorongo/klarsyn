import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

// NOTE: ruta reference is the commonly-cited box for "Resor till och från
// arbetet" — unverified against a real, current Skatteverket-published
// blankett, same open question as the threshold in rules/resor.ts.
const RUTA = "Ruta 2.1 — Resor till och från arbetet";

export function buildResorGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: RUTA,
      dokumentationskrav: [
        "Uppgifter om avstånd och antal resdagar",
        "Kvitton eller reseräkning om du reser kollektivt",
      ],
      steg: [
        "Dina svar räckte inte för att beräkna reseavdraget automatiskt — kontrollera manuellt mot Skatteverkets villkor för reseavdrag.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: RUTA,
    dokumentationskrav: [
      "Reseräkning eller körjournal med avstånd och resdagar",
      "Kvitton för kollektivtrafik, om tillämpligt",
    ],
    steg: [
      `Fyll i ${RUTA.toLowerCase()} i din inkomstdeklaration.`,
      `Ange ett reseavdrag på ${formatKr(result.amountOre)} — ${result.motivation}`,
      "Spara underlaget i två år ifall Skatteverket begär att se det.",
    ],
  };
}
