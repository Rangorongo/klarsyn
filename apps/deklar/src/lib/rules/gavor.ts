import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket's published rules for inkomstår 2025
// (deklaration 2026): 25% tax reduction on qualifying donations, min 2,000 kr
// total per year (min 200 kr per single gift to the same approved recipient),
// max reduction 3,000 kr (i.e. qualifying amount capped at 12,000 kr).
// https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattereduktioner.4.3810a01c150939e893f1a17e.html
const MIN_ARSBELOPP_ORE = 2_000_00;
const MAX_KVALIFICERANDE_ORE = 12_000_00;
const RATE = 0.25;

const HAR_SKANKT_QUESTION: Question = {
  id: "harSkanktGavor",
  prompt:
    "Har du skänkt pengar till en godkänd gåvomottagare (t.ex. en etablerad hjälporganisation eller forskningsfond) för minst 2 000 kr totalt under året?",
  type: "boolean",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
const GAVOBELOPP_QUESTION: Question = {
  id: "gavobeloppKr",
  prompt:
    "Hur mycket skänkte du totalt under året (kr)? Räkna bara med gåvor på minst 200 kr per tillfälle till samma mottagare.",
  type: "number",
};

const REDAN_FORIFYLLT_QUESTION: Question = {
  id: "gavorRedanForifyllt",
  prompt: "Syns skattereduktionen redan i din förifyllda deklaration?",
  type: "boolean",
};

export const gavorRule: Rule = {
  id: "gavor",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harSkanktGavor === true) {
      return [HAR_SKANKT_QUESTION, GAVOBELOPP_QUESTION, REDAN_FORIFYLLT_QUESTION];
    }
    return [HAR_SKANKT_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.harSkanktGavor === false) {
      return {
        badge: "Ej aktuell",
        title: "Skattereduktion för gåvor",
        amountOre: 0,
        motivation: "Du har uppgett att du inte skänkt till välgörenhet i år.",
        source: "Skatteverket — Skattereduktion för gåvor",
        needsReview: false,
      };
    }

    if (answers.harSkanktGavor !== true) {
      return {
        badge: "Kräver mer information",
        title: "Skattereduktion för gåvor",
        amountOre: null,
        motivation: "Svar saknas på om du skänkt till välgörenhet i år.",
        source: "Skatteverket — Skattereduktion för gåvor",
        needsReview: true,
      };
    }

    const gavobeloppKr = answers.gavobeloppKr;
    const redanForifyllt = answers.gavorRedanForifyllt;
    if (
      typeof gavobeloppKr !== "number" ||
      typeof redanForifyllt !== "boolean"
    ) {
      return {
        badge: "Kräver mer information",
        title: "Skattereduktion för gåvor",
        amountOre: null,
        motivation: "Svar saknas för att beräkna skattereduktionen.",
        source: "Skatteverket — Skattereduktion för gåvor",
        needsReview: true,
      };
    }

    const gavobeloppOre = Math.round(gavobeloppKr * 100);
    if (gavobeloppOre < MIN_ARSBELOPP_ORE) {
      return {
        badge: "Under minimibeloppet",
        title: "Skattereduktion för gåvor",
        amountOre: 0,
        motivation:
          "Gåvor under 2 000 kr totalt per år ger ingen skattereduktion.",
        source: "Skatteverket — Skattereduktion för gåvor",
        needsReview: false,
      };
    }

    if (redanForifyllt) {
      return {
        badge: "Redan förifyllt",
        title: "Skattereduktion för gåvor",
        amountOre: 0,
        motivation:
          "Skattereduktionen för dina gåvor syns redan i deklarationen — inget extra att lägga till.",
        source: "Skatteverket — Skattereduktion för gåvor",
        needsReview: false,
      };
    }

    const kvalificerandeOre = Math.min(gavobeloppOre, MAX_KVALIFICERANDE_ORE);
    const amountOre = Math.round(kvalificerandeOre * RATE);
    return {
      badge: "Avdrag hittat",
      title: "Skattereduktion för gåvor",
      amountOre,
      motivation:
        "25 % skattereduktion på gåvor upp till 12 000 kr/år (max 3 000 kr) — inte förifylld, så kontrollera med gåvomottagaren och lägg till den själv om den saknas.",
      source: "Skatteverket — Skattereduktion för gåvor",
      needsReview: false,
    };
  },
};
