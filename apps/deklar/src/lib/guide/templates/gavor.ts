import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Skattereduktion för gåvor";

export function buildGavorGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: ["Kvitton eller bekräftelser från gåvomottagaren"],
      steg: [
        "Dina svar räckte inte för att beräkna skattereduktionen automatiskt — kontrollera manuellt mot Skatteverkets villkor för gåvor.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Kvitton eller bekräftelser från gåvomottagaren som visar belopp och datum",
    ],
    steg: [
      "Godkända gåvomottagare rapporterar normalt gåvan direkt till Skatteverket med ditt personnummer.",
      `Om reduktionen ändå inte syns: kontakta gåvomottagaren och be dem kontrollera sin rapportering — ${result.motivation}`,
      `Uppskattad skattereduktion: ${formatKr(result.amountOre)}.`,
    ],
  };
}
