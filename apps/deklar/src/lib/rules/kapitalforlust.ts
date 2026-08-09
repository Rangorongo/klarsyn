import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { underskottAvKapitalSkattereduktion } from "./ranta";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket for marknadsnoterade aktier/fonder (not
// ISK/kapitalförsäkring, which are taxed differently and never produce a
// deductible loss like this):
// https://www.skatteverket.se/privat/skatter/vardepapper/deklareraaktierochovrigavardepapper/kvittningochkvotering.4.7be5268414bea0646945a21.html
//
// Mechanism: gains and losses in the same year are netted directly first.
// Only a *remaining* net loss is kvoterad to 70% deductible, which then
// feeds the same underskott av kapital pool as ranta.ts's ränteavdrag —
// see the caveat there. We deliberately do NOT ask about onoterade
// (unlisted) securities, which have different kvotering rates — out of
// scope for this rule.
const KVOTERING_ANDEL = 0.7;

const HAR_FORLUST_QUESTION: Question = {
  id: "harKapitalforlust",
  prompt:
    "Har du sålt marknadsnoterade aktier eller fonder (utanför ISK/kapitalförsäkring) med förlust under året?",
  type: "boolean",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
const FORLUST_QUESTION: Question = {
  id: "kapitalforlustKr",
  prompt:
    "Vad var din sammanlagda förlust vid försäljning av aktier/fonder under året (kr)?",
  type: "number",
};

const VINST_QUESTION: Question = {
  id: "kapitalvinstKr",
  prompt:
    "Hade du också vinster vid försäljning av marknadsnoterade aktier/fonder samma år (kr)? Ange 0 om inga — vinster nettas mot förlusten innan resten kvoteras.",
  type: "number",
};

const REDAN_FORIFYLLT_QUESTION: Question = {
  id: "kapitalforlustRedanForifyllt",
  prompt:
    "Syns den här förlusten redan i din förifyllda deklaration (vanligt om din bank/mäklare rapporterar automatiskt)?",
  type: "boolean",
};

function needsReview(): RuleResult {
  return {
    badge: "Kräver mer information",
    title: "Kapitalförlust — aktier och fonder",
    amountOre: null,
    motivation: "Svar saknas för att beräkna skattereduktionen.",
    source: "Skatteverket — Kvittning och kvotering",
    needsReview: true,
  };
}

export const kapitalforlustRule: Rule = {
  id: "kapitalforlust",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harKapitalforlust === true) {
      return [
        HAR_FORLUST_QUESTION,
        FORLUST_QUESTION,
        VINST_QUESTION,
        REDAN_FORIFYLLT_QUESTION,
      ];
    }
    return [HAR_FORLUST_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.harKapitalforlust === false) {
      return {
        badge: "Ej aktuell",
        title: "Kapitalförlust — aktier och fonder",
        amountOre: 0,
        motivation:
          "Du har uppgett att du inte sålt aktier/fonder med förlust i år.",
        source: "Skatteverket — Kvittning och kvotering",
        needsReview: false,
      };
    }

    if (answers.harKapitalforlust !== true) {
      return needsReview();
    }

    const forlustKr = answers.kapitalforlustKr;
    const vinstKr = answers.kapitalvinstKr;
    const redanForifyllt = answers.kapitalforlustRedanForifyllt;
    if (
      typeof forlustKr !== "number" ||
      typeof vinstKr !== "number" ||
      typeof redanForifyllt !== "boolean"
    ) {
      return needsReview();
    }

    const nettoForlustKr = Math.max(forlustKr - Math.max(vinstKr, 0), 0);
    if (nettoForlustKr <= 0) {
      return {
        badge: "Inget att hitta",
        title: "Kapitalförlust — aktier och fonder",
        amountOre: 0,
        motivation:
          "Dina vinster samma år täcker hela förlusten — inget kvar att kvotera.",
        source: "Skatteverket — Kvittning och kvotering",
        needsReview: false,
      };
    }

    if (redanForifyllt) {
      return {
        badge: "Redan förifyllt",
        title: "Kapitalförlust — aktier och fonder",
        amountOre: 0,
        motivation:
          "Den här förlusten är redan förifylld — inget extra att lägga till.",
        source: "Skatteverket — Kvittning och kvotering",
        needsReview: false,
      };
    }

    const kvoteradForlustOre = Math.round(
      nettoForlustKr * 100 * KVOTERING_ANDEL,
    );
    const amountOre = underskottAvKapitalSkattereduktion(kvoteradForlustOre);

    return {
      badge: "Avdrag hittat",
      title: "Kapitalförlust — aktier och fonder",
      amountOre,
      motivation:
        "70 % av din nettoförlust är avdragsgill, vilket ger 30 % skattereduktion (21 % på den del som tillsammans med eventuella ränteutgifter överstiger 100 000 kr). Räknat separat från ett eventuellt ränteavdrag — om du har båda och ligger nära gränsen, dubbelkolla den sammanlagda summan.",
      source: "Skatteverket — Kvittning och kvotering",
      needsReview: false,
    };
  },
};
