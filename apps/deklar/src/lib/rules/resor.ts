import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket for deklaration 2026 (inkomstår 2025):
// https://www.skatteverket.se/privat/skatter/bilochtrafik/avdragforresortillochfranarbetet.4.3810a01c150939e893f25603.html
// MAINTENANCE: Riksdagen has already decided TROSKEL_ORE rises to 15,000 kr
// from and with inkomstår 2026 (deklaration 2027) — update Underlag.inkomstar
// gating here once that filing season is live.
const TROSKEL_ORE = 11_000_00;
const MIL_ERSATTNING_ORE = 25_00;
const MINSTA_AVSTAND_KM = 5;

const FARDMEDEL_QUESTION: Question = {
  id: "fardmedel",
  prompt: "Hur reser du normalt till arbetet?",
  type: "text",
  options: ["bil", "kollektivt"],
};

const AVSTAND_QUESTION: Question = {
  id: "avstandKm",
  prompt: "Hur långt är det en väg (km) mellan bostad och arbete?",
  type: "number",
};

// Required for a car-based deduction alongside the 5km minimum — easy to
// miss, so asked explicitly rather than assumed.
const SPARAR_TID_QUESTION: Question = {
  id: "spararTid",
  prompt:
    "Sparar du minst två timmar per dag på att köra bil jämfört med att åka kollektivt?",
  type: "boolean",
};

const ARBETSDAGAR_QUESTION: Question = {
  id: "arbetsdagarPerAr",
  prompt: "Hur många dagar per år reser du till arbetsplatsen?",
  type: "number",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
// (Previously named kollektivtKostnadOre and used without conversion — a
// ~100x under-computation bug, fixed together with the same mistake in the
// newer ranta/rutRot/gavor rules.)
const KOLLEKTIVT_KOSTNAD_QUESTION: Question = {
  id: "kollektivtKostnadKr",
  prompt:
    "Vad kostade dina resor med kollektivtrafik till och från arbetet totalt under året (kr)?",
  type: "number",
};

function needsReview(): RuleResult {
  return {
    badge: "Kräver mer information",
    title: "Reseavdrag",
    amountOre: null,
    motivation: "Svar saknas för att beräkna reseavdraget.",
    source: "Skatteverket — Resor till och från arbetet",
    needsReview: true,
  };
}

function computed(amountOre: number): RuleResult {
  return {
    badge: amountOre > 0 ? "Avdrag hittat" : "Under tröskelvärdet",
    title: "Reseavdrag",
    amountOre,
    motivation:
      amountOre > 0
        ? "Dina resekostnader överstiger tröskelbeloppet för reseavdrag."
        : "Dina resekostnader överstiger inte tröskelbeloppet på 11 000 kr.",
    source: "Skatteverket — Resor till och från arbetet",
    needsReview: false,
  };
}

export const resorRule: Rule = {
  id: "resor",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.fardmedel === "bil") {
      if (previousAnswers.spararTid === false) {
        // Disqualified regardless of days traveled — no need to ask.
        return [FARDMEDEL_QUESTION, AVSTAND_QUESTION, SPARAR_TID_QUESTION];
      }
      return [
        FARDMEDEL_QUESTION,
        AVSTAND_QUESTION,
        SPARAR_TID_QUESTION,
        ARBETSDAGAR_QUESTION,
      ];
    }
    if (previousAnswers.fardmedel === "kollektivt") {
      return [FARDMEDEL_QUESTION, KOLLEKTIVT_KOSTNAD_QUESTION];
    }
    return [FARDMEDEL_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.fardmedel === "bil") {
      const avstandKm = answers.avstandKm;
      const spararTid = answers.spararTid;
      if (typeof avstandKm !== "number" || typeof spararTid !== "boolean") {
        return needsReview();
      }
      if (avstandKm < MINSTA_AVSTAND_KM) {
        return computed(0);
      }
      if (!spararTid) {
        return {
          badge: "Uppfyller inte kraven",
          title: "Reseavdrag",
          amountOre: 0,
          motivation:
            "Bilresor ger bara avdrag om du sparar minst två timmar per dag jämfört med kollektivtrafik — det uppfyller du inte enligt dina svar.",
          source: "Skatteverket — Resor till och från arbetet",
          needsReview: false,
        };
      }

      const arbetsdagarPerAr = answers.arbetsdagarPerAr;
      if (typeof arbetsdagarPerAr !== "number") {
        return needsReview();
      }
      const totalMil = (avstandKm * 2 * arbetsdagarPerAr) / 10;
      const totalKostnadOre = Math.round(totalMil * MIL_ERSATTNING_ORE);
      return computed(Math.max(0, totalKostnadOre - TROSKEL_ORE));
    }

    if (answers.fardmedel === "kollektivt") {
      const kollektivtKostnadKr = answers.kollektivtKostnadKr;
      if (typeof kollektivtKostnadKr !== "number") {
        return needsReview();
      }
      const kollektivtKostnadOre = Math.round(kollektivtKostnadKr * 100);
      return computed(Math.max(0, kollektivtKostnadOre - TROSKEL_ORE));
    }

    return needsReview();
  },
};
