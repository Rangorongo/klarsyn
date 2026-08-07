import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Rot- och rutavdrag";

export function buildRutRotGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: ["Fakturor från utförarna med specificerad arbetskostnad"],
      steg: [
        "Dina svar räckte inte för att beräkna RUT/ROT-reduktionen automatiskt — kontrollera manuellt mot Skatteverkets villkor.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Fakturor från samtliga utförare med specificerad arbetskostnad (exkl. material)",
    ],
    steg: [
      "RUT/ROT-avdrag begärs normalt av utföraren direkt vid fakturering, med ditt personnummer.",
      `Om det inte skedde: kontakta utföraren och be dem begära utbetalning från Skatteverket i efterhand, eller kontakta Skatteverket direkt — ${result.motivation}`,
      `Uppskattad skattereduktion: ${formatKr(result.amountOre)}.`,
    ],
  };
}
