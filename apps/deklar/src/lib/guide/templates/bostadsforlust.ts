import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Försäljning av bostad (K5/K6)";

export function buildBostadsforlustGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: [
        "Köpekontrakt och slutlig avräkning från försäljningen",
        "Underlag för anskaffnings- och förbättringsutgifter",
      ],
      steg: [
        "Dina svar räckte inte för att beräkna skattereduktionen automatiskt — kontrollera manuellt mot Skatteverkets villkor för förlust vid bostadsförsäljning.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Köpekontrakt och slutlig avräkning från försäljningen",
      "Underlag för anskaffnings- och förbättringsutgifter",
    ],
    steg: [
      `Fyll i K5- eller K6-bilagan med försäljningen om det inte redan är gjort.`,
      `Uppskattad skattereduktion: ${formatKr(result.amountOre)} — ${result.motivation}`,
      "Spara köpekontrakt och kvitton i minst ett år ifall Skatteverket begär att se dem.",
    ],
  };
}
