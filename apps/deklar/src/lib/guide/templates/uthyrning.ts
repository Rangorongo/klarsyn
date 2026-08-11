import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

const OMRADE = "Uthyrning av privatbostad";

export function buildUthyrningGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: [
        "Hyreskontrakt eller motsvarande underlag för uthyrningen",
        "Kvitton på egen avgift/hyra under uthyrningsperioden",
      ],
      steg: [
        "Dina svar räckte inte för att beräkna skattereduktionen automatiskt — kontrollera manuellt mot Skatteverkets villkor för uthyrning av privatbostad.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Hyreskontrakt eller motsvarande underlag för uthyrningen",
      "Kvitton på egen avgift/hyra under uthyrningsperioden",
    ],
    steg: [
      `Redovisa hyresintäkten under "${OMRADE}" i din deklaration, med schablonavdraget och din egen avgift/hyra avdragna.`,
      `Uppskattad skattereduktion: ${formatKr(result.amountOre)} — ${result.motivation}`,
      "Spara hyreskontrakt och kvitton i minst ett år ifall Skatteverket begär att se dem.",
    ],
  };
}
