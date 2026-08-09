import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Tillfälligt arbete och dubbel bosättning";

export function buildDubbelBosattningGuide(
  result: RuleResult,
): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: [
        "Hyreskontrakt eller motsvarande för den tillfälliga bostaden",
        "Underlag som visar avståndet till folkbokföringsadressen",
        "Anställningsbevis eller motsvarande som styrker varför arbetet kräver den tillfälliga bostaden",
      ],
      steg: [
        "Dina svar räckte inte för att beräkna avdraget automatiskt — kontrollera manuellt mot Skatteverkets villkor för dubbel bosättning.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Kvitton/hyresavier som styrker din faktiska boendekostnad",
      "Kvitton eller biljetter för dina hemresor",
      "Underlag som visar avstånd och när den dubbla bosättningen började",
    ],
    steg: [
      `Fyll i avdrag för ${OMRADE.toLowerCase()} i din inkomstdeklaration.`,
      `Uppskattat avdrag: ${formatKr(result.amountOre)} — ${result.motivation}`,
      "Spara alla kvitton i minst ett år ifall Skatteverket begär att se dem.",
    ],
  };
}
