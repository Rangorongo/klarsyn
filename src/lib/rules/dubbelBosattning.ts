import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

const HAR_DUBBEL_BOSATTNING_QUESTION: Question = {
  id: "harDubbelBosattning",
  prompt:
    "Bor du på en annan ort än din folkbokföringsadress på grund av ditt arbete?",
  type: "boolean",
};

const BESKRIVNING_QUESTION: Question = {
  id: "beskrivning",
  prompt:
    "Beskriv kort din situation (t.ex. varför, sedan när, avstånd till folkbokföringsadressen).",
  type: "text",
};

export const dubbelBosattningRule: Rule = {
  id: "dubbelBosattning",

  // Underlag (Skatteverket's prefilled data) has no signal for this — it's
  // entirely self-reported. Always a candidate so the interview question is
  // never silently skipped.
  appliesTo(_underlag: Underlag): boolean {
    return true;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harDubbelBosattning === true) {
      return [HAR_DUBBEL_BOSATTNING_QUESTION, BESKRIVNING_QUESTION];
    }
    return [HAR_DUBBEL_BOSATTNING_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.harDubbelBosattning === false) {
      return {
        badge: "Ej aktuell",
        title: "Dubbel bosättning",
        amountOre: 0,
        motivation: "Du har uppgett att dubbel bosättning inte gäller dig.",
        source: "Skatteverket — Dubbel bosättning",
        needsReview: false,
      };
    }

    if (answers.harDubbelBosattning === true) {
      return {
        badge: "Kräver manuell kontroll",
        title: "Dubbel bosättning",
        amountOre: null,
        motivation:
          "Dubbel bosättning kan inte beräknas automatiskt — beloppet beror på faktiska omständigheter som måste kontrolleras manuellt.",
        source: "Skatteverket — Dubbel bosättning",
        needsReview: true,
      };
    }

    return {
      badge: "Kräver mer information",
      title: "Dubbel bosättning",
      amountOre: null,
      motivation: "Svar saknas på om dubbel bosättning gäller dig.",
      source: "Skatteverket — Dubbel bosättning",
      needsReview: true,
    };
  },
};
