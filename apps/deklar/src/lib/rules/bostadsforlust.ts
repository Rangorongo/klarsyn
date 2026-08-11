import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { underskottAvKapitalSkattereduktion } from "./ranta";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket: 50% of a loss on selling a privatbostad
// (småhus or äkta bostadsrätt) is deductible, 63% for oäkta bostadsrätt.
// https://www.skatteverket.se/privat/fastigheterochbostad/forsaljningavbostad/raknautvinstforlustochskatt.4.233f91f71260075abe8800033595.html
// Feeds the same underskott av kapital pool as ranta.ts/kapitalforlust.ts —
// see the combined-threshold caveat there.
const KVOTERING_AKTA = 0.5;
const KVOTERING_OAKTA = 0.63;

const HAR_SALT_QUESTION: Question = {
  id: "harSaltBostadMedForlust",
  prompt: "Har du sålt en bostad (hus eller bostadsrätt) med förlust under året?",
  type: "boolean",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
const FORLUST_QUESTION: Question = {
  id: "bostadsforlustKr",
  prompt: "Vad var förlusten vid försäljningen (kr)?",
  type: "number",
};

const OAKTA_QUESTION: Question = {
  id: "oaktaBostadsratt",
  prompt:
    "Var det en oäkta bostadsrätt (t.ex. i en oäkta bostadsrättsförening)? Osäker? Svara nej — de allra flesta bostadsrätter är äkta.",
  type: "boolean",
};

const REDAN_FORIFYLLT_QUESTION: Question = {
  id: "bostadsforlustRedanForifyllt",
  prompt: "Syns det här avdraget redan i din förifyllda deklaration?",
  type: "boolean",
};

function needsReview(): RuleResult {
  return {
    badge: "Kräver mer information",
    title: "Förlust vid bostadsförsäljning",
    amountOre: null,
    motivation: "Svar saknas för att beräkna skattereduktionen.",
    source: "Skatteverket — Försäljning av bostad",
    needsReview: true,
  };
}

export const bostadsforlustRule: Rule = {
  id: "bostadsforlust",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harSaltBostadMedForlust === true) {
      return [
        HAR_SALT_QUESTION,
        FORLUST_QUESTION,
        OAKTA_QUESTION,
        REDAN_FORIFYLLT_QUESTION,
      ];
    }
    return [HAR_SALT_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.harSaltBostadMedForlust === false) {
      return {
        badge: "Ej aktuell",
        title: "Förlust vid bostadsförsäljning",
        amountOre: 0,
        motivation:
          "Du har uppgett att du inte sålt en bostad med förlust i år.",
        source: "Skatteverket — Försäljning av bostad",
        needsReview: false,
      };
    }

    if (answers.harSaltBostadMedForlust !== true) {
      return needsReview();
    }

    const forlustKr = answers.bostadsforlustKr;
    const oakta = answers.oaktaBostadsratt;
    const redanForifyllt = answers.bostadsforlustRedanForifyllt;
    if (
      typeof forlustKr !== "number" ||
      typeof oakta !== "boolean" ||
      typeof redanForifyllt !== "boolean"
    ) {
      return needsReview();
    }

    if (redanForifyllt) {
      return {
        badge: "Redan förifyllt",
        title: "Förlust vid bostadsförsäljning",
        amountOre: 0,
        motivation:
          "Det här avdraget syns redan i deklarationen — inget extra att lägga till.",
        source: "Skatteverket — Försäljning av bostad",
        needsReview: false,
      };
    }

    const kvoteringsandel = oakta ? KVOTERING_OAKTA : KVOTERING_AKTA;
    const kvoteradForlustOre = Math.round(
      forlustKr * 100 * kvoteringsandel,
    );
    const amountOre = underskottAvKapitalSkattereduktion(kvoteradForlustOre);

    return {
      badge: "Avdrag hittat",
      title: "Förlust vid bostadsförsäljning",
      amountOre,
      motivation: `${Math.round(kvoteringsandel * 100)} % av förlusten är avdragsgill, vilket ger skattereduktion enligt samma skiktade sats som ränteavdrag/kapitalförlust — inte förifyllt, så lägg till det själv.`,
      source: "Skatteverket — Försäljning av bostad",
      needsReview: false,
    };
  },
};
