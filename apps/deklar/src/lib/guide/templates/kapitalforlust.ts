import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Kapitalvinst/-förlust — marknadsnoterade aktier och fonder (K4)";

export function buildKapitalforlustGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: ["Avräkningsnotor eller kontoutdrag från mäklaren"],
      steg: [
        "Dina svar räckte inte för att beräkna skattereduktionen automatiskt — kontrollera manuellt mot Skatteverkets kvittnings- och kvoteringsregler.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Avräkningsnotor eller kontoutdrag som visar köp- och säljpris",
    ],
    steg: [
      `Fyll i K4-bilagan med dina affärer om det inte redan är gjort av din bank/mäklare.`,
      `Uppskattad skattereduktion: ${formatKr(result.amountOre)} — ${result.motivation}`,
      "Spara avräkningsnotorna i minst ett år ifall Skatteverket begär att se dem.",
    ],
  };
}
