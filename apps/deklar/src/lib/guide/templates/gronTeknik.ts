import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Skattereduktion för grön teknik";

export function buildGronTeknikGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: ["Faktura från installatören med specificerad kostnad"],
      steg: [
        "Dina svar räckte inte för att beräkna skattereduktionen automatiskt — kontrollera manuellt mot Skatteverkets villkor för grön teknik.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Faktura från installatören med specificerad arbets- och materialkostnad",
    ],
    steg: [
      "Skattereduktion för grön teknik begärs normalt av installatören direkt vid fakturering, med ditt personnummer.",
      `Om det inte skedde: kontakta installatören och be dem begära utbetalning från Skatteverket i efterhand, eller kontakta Skatteverket direkt — ${result.motivation}`,
      `Uppskattad skattereduktion: ${formatKr(result.amountOre)}.`,
    ],
  };
}
