import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// NOTE: threshold and mileage rate are the widely-cited figures for reseavdrag
// (arbetsresor) at design time. Not yet verified against Skatteverket's
// current published rules for the relevant inkomstår — see open question #4
// in docs/superpowers/specs/2026-07-29-deklar-cloud-webapp-design.md.
const TROSKEL_ORE = 11_000_00;
const MIL_ERSATTNING_ORE = 25_00;
const MINSTA_AVSTAND_KM = 5;

const FARDMEDEL_QUESTION: Question = {
  id: "fardmedel",
  prompt: "Hur reser du normalt till arbetet?",
  type: "text",
};

const AVSTAND_QUESTION: Question = {
  id: "avstandKm",
  prompt: "Hur långt är det en väg (km) mellan bostad och arbete?",
  type: "number",
};

const ARBETSDAGAR_QUESTION: Question = {
  id: "arbetsdagarPerAr",
  prompt: "Hur många dagar per år reser du till arbetsplatsen?",
  type: "number",
};

const KOLLEKTIVT_KOSTNAD_QUESTION: Question = {
  id: "kollektivtKostnadOre",
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
      return [FARDMEDEL_QUESTION, AVSTAND_QUESTION, ARBETSDAGAR_QUESTION];
    }
    if (previousAnswers.fardmedel === "kollektivt") {
      return [FARDMEDEL_QUESTION, KOLLEKTIVT_KOSTNAD_QUESTION];
    }
    return [FARDMEDEL_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.fardmedel === "bil") {
      const avstandKm = answers.avstandKm;
      const arbetsdagarPerAr = answers.arbetsdagarPerAr;
      if (
        typeof avstandKm !== "number" ||
        typeof arbetsdagarPerAr !== "number"
      ) {
        return needsReview();
      }
      if (avstandKm < MINSTA_AVSTAND_KM) {
        return computed(0);
      }
      const totalMil = (avstandKm * 2 * arbetsdagarPerAr) / 10;
      const totalKostnadOre = Math.round(totalMil * MIL_ERSATTNING_ORE);
      return computed(Math.max(0, totalKostnadOre - TROSKEL_ORE));
    }

    if (answers.fardmedel === "kollektivt") {
      const kollektivtKostnadOre = answers.kollektivtKostnadOre;
      if (typeof kollektivtKostnadOre !== "number") {
        return needsReview();
      }
      return computed(Math.max(0, kollektivtKostnadOre - TROSKEL_ORE));
    }

    return needsReview();
  },
};
