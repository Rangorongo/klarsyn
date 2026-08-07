import { formatKr } from "@/lib/format";
import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

// Ränteutgifter are normally reported directly to Skatteverket by banks and
// appear prefilled under "Inkomst av kapital". The exact box/ruta for a
// manual correction is not verified here — see open question #4 in
// docs/superpowers/specs/2026-07-29-deklar-cloud-webapp-design.md.
const OMRADE = "Inkomst av kapital";

export function buildRantaGuide(result: RuleResult): GuideStep | null {
  if (result.needsReview) {
    return {
      ruta: OMRADE,
      dokumentationskrav: ["Kontrolluppgift eller årsbesked från din bank"],
      steg: [
        "Dina svar räckte inte för att beräkna skattereduktionen automatiskt — kontrollera manuellt mot Skatteverkets regler för underskott av kapital.",
      ],
    };
  }

  if (result.amountOre === null || result.amountOre <= 0) {
    return null;
  }

  return {
    ruta: OMRADE,
    dokumentationskrav: [
      "Kontrolluppgift eller årsbesked från banken/långivaren som visar räntekostnaden",
    ],
    steg: [
      `Kontrollera avsnittet "${OMRADE}" i din deklaration — om räntan inte redan är förifylld, lägg till den där.`,
      `Skattereduktionen blir ungefär ${formatKr(result.amountOre)} — ${result.motivation}`,
      "Om långivaren inte rapporterar till Skatteverket (t.ex. ett utländskt lån), kontakta Skatteverket för att få det tillagt manuellt.",
    ],
  };
}
