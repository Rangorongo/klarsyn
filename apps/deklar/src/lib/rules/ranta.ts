import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket's published rules for inkomstår 2025
// (deklaration 2026): 30% tax reduction on underskott av kapital up to
// 100,000 kr, 21% on the portion above that.
// https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattereduktioner.4.3810a01c150939e893f1a17e.html
//
// This threshold and rate are shared with rules/kapitalforlust.ts — ränta
// and kvoterad aktie-/fondförlust both feed the SAME underskott av kapital
// pool in reality, one combined 100,000 kr threshold, not one each. We
// still compute them as two independent rules (simpler, matches this app's
// one-rule-one-question-flow architecture) — see the caveat in
// kapitalforlust.ts's motivation text about combined totals near/above the
// threshold.
export const UNDERSKOTT_TROSKEL_ORE = 100_000_00;
const TROSKEL_ORE = UNDERSKOTT_TROSKEL_ORE;
const RATE_LOW = 0.3;
const RATE_HIGH = 0.21;

const HAR_RANTEUTGIFTER_QUESTION: Question = {
  id: "harRanteutgifter",
  prompt:
    "Har du haft ränteutgifter under året, t.ex. på bolån, billån eller blancolån?",
  type: "boolean",
};

// Answered in kr (as displayed to the user) — converted to öre in compute(),
// matching the convention in rules/krypto.ts (never store a raw kr answer
// directly in an "...Ore" field, see the interview-flow unit bug it avoids).
const RANTEUTGIFTER_QUESTION: Question = {
  id: "ranteutgifterKr",
  prompt: "Hur mycket betalade du totalt i ränta under året (kr)?",
  type: "number",
};

const REDAN_FORIFYLLT_QUESTION: Question = {
  id: "ranteRedanForifyllt",
  prompt: "Syns dessa ränteutgifter redan i din förifyllda deklaration?",
  type: "boolean",
};

// Shared with kapitalforlust.ts — see the note on UNDERSKOTT_TROSKEL_ORE.
export function underskottAvKapitalSkattereduktion(
  underskottOre: number,
): number {
  if (underskottOre <= TROSKEL_ORE) {
    return Math.round(underskottOre * RATE_LOW);
  }
  return Math.round(
    TROSKEL_ORE * RATE_LOW + (underskottOre - TROSKEL_ORE) * RATE_HIGH,
  );
}

export const rantaRule: Rule = {
  id: "ranta",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harRanteutgifter === true) {
      return [
        HAR_RANTEUTGIFTER_QUESTION,
        RANTEUTGIFTER_QUESTION,
        REDAN_FORIFYLLT_QUESTION,
      ];
    }
    return [HAR_RANTEUTGIFTER_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.harRanteutgifter === false) {
      return {
        badge: "Ej aktuell",
        title: "Skattereduktion för ränteutgifter",
        amountOre: 0,
        motivation: "Du har uppgett att du inte haft ränteutgifter i år.",
        source: "Skatteverket — Skattereduktion för underskott av kapital",
        needsReview: false,
      };
    }

    if (answers.harRanteutgifter !== true) {
      return {
        badge: "Kräver mer information",
        title: "Skattereduktion för ränteutgifter",
        amountOre: null,
        motivation: "Svar saknas på om du haft ränteutgifter i år.",
        source: "Skatteverket — Skattereduktion för underskott av kapital",
        needsReview: true,
      };
    }

    const ranteutgifterKr = answers.ranteutgifterKr;
    const redanForifyllt = answers.ranteRedanForifyllt;
    if (
      typeof ranteutgifterKr !== "number" ||
      typeof redanForifyllt !== "boolean"
    ) {
      return {
        badge: "Kräver mer information",
        title: "Skattereduktion för ränteutgifter",
        amountOre: null,
        motivation: "Svar saknas för att beräkna skattereduktionen.",
        source: "Skatteverket — Skattereduktion för underskott av kapital",
        needsReview: true,
      };
    }

    if (redanForifyllt) {
      return {
        badge: "Redan förifyllt",
        title: "Skattereduktion för ränteutgifter",
        amountOre: 0,
        motivation:
          "Dina ränteutgifter är redan förifyllda av banken — inget extra att lägga till.",
        source: "Skatteverket — Skattereduktion för underskott av kapital",
        needsReview: false,
      };
    }

    const ranteutgifterOre = Math.round(ranteutgifterKr * 100);
    const amountOre = underskottAvKapitalSkattereduktion(ranteutgifterOre);
    return {
      badge: amountOre > 0 ? "Avdrag hittat" : "Inget att hitta",
      title: "Skattereduktion för ränteutgifter",
      amountOre,
      motivation:
        amountOre > 0
          ? "30 % skattereduktion på ränteutgifter upp till 100 000 kr, 21 % på resten — inte förifyllt, så lägg till det själv."
          : "Inga ränteutgifter angivna att räkna på.",
      source: "Skatteverket — Skattereduktion för underskott av kapital",
      needsReview: false,
    };
  },
};
