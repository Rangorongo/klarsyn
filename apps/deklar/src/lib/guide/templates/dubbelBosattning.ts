import type { RuleResult } from "@/lib/rules/types";
import type { GuideStep } from "../types";

// NOTE: ruta reference is the commonly-cited box for "Tillfälligt arbete,
// dubbel bosättning och hemresor" — unverified against a real, current
// Skatteverket-published blankett, same open question noted in
// rules/dubbelBosattning.ts.
const RUTA = "Ruta 2.2 — Tillfälligt arbete, dubbel bosättning och hemresor";

export function buildDubbelBosattningGuide(
  result: RuleResult,
): GuideStep | null {
  if (!result.needsReview) {
    return null;
  }

  return {
    ruta: RUTA,
    dokumentationskrav: [
      "Hyreskontrakt eller motsvarande för den tillfälliga bostaden",
      "Underlag som visar avståndet till familjens bostad",
      "Anställningsbevis eller motsvarande som styrker varför arbetet kräver den tillfälliga bostaden",
    ],
    steg: [
      "Dubbel bosättning kan inte beräknas automatiskt — kontrollera manuellt mot Skatteverkets villkor, eller kontakta en handläggare vid osäkerhet.",
      `Om du är berättigad, fyll i ${RUTA.toLowerCase()} med ditt underlag.`,
    ],
  };
}
