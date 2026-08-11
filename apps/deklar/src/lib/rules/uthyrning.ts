import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket for inkomstår 2025:
// https://www.skatteverket.se/privat/fastigheterochbostad/inkomsterfranbostad/hyrautprivatbostadbostadsrattsmahusochhyresratt.4.233f91f71260075abe8800033479.html
// 40,000 kr schablonavdrag per bostad/år, plus faktisk hyra (hyresrätt) eller
// avgift (bostadsrätt) för uthyrningsperioden — inget motsvarande tillägg
// för småhus. 30% skatt (kapitalinkomst) på överskottet.
const SCHABLON_ORE = 40_000_00;
const SKATTESATS = 0.3;

const HAR_HYRT_UT_QUESTION: Question = {
  id: "harHyrtUt",
  prompt:
    "Har du hyrt ut din bostad (helt eller delvis — bostadsrätt, hyresrätt eller hus) under året?",
  type: "boolean",
};

const HYRESINTAKT_QUESTION: Question = {
  id: "hyresintaktKr",
  prompt: "Hur mycket fick du totalt in i hyra under året (kr)?",
  type: "number",
};

const BOSTADSTYP_QUESTION: Question = {
  id: "uthyrningBostadstyp",
  prompt: "Vilken typ av bostad hyrde du ut?",
  type: "text",
  options: ["bostadsratt", "hyresratt", "smahus"],
};

const FAKTISK_KOSTNAD_QUESTION: Question = {
  id: "uthyrningFaktiskKostnadKr",
  prompt:
    "Hur mycket betalade du själv i avgift (bostadsrätt) eller hyra (hyresrätt) för uthyrningsperioden (kr)? Ange 0 om du hyrde ut ett hus.",
  type: "number",
};

const REDAN_REDOVISAT_QUESTION: Question = {
  id: "uthyrningRedanRedovisat",
  prompt:
    "Har du redan dragit av schablonbeloppet (och ev. avgift/hyra) när du redovisade den här hyresintäkten?",
  type: "boolean",
};

function needsReview(): RuleResult {
  return {
    badge: "Kräver mer information",
    title: "Uthyrning av privatbostad",
    amountOre: null,
    motivation: "Svar saknas för att beräkna skattereduktionen.",
    source: "Skatteverket — Uthyrning av privatbostad",
    needsReview: true,
  };
}

export const uthyrningRule: Rule = {
  id: "uthyrning",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harHyrtUt === true) {
      return [
        HAR_HYRT_UT_QUESTION,
        HYRESINTAKT_QUESTION,
        BOSTADSTYP_QUESTION,
        FAKTISK_KOSTNAD_QUESTION,
        REDAN_REDOVISAT_QUESTION,
      ];
    }
    return [HAR_HYRT_UT_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.harHyrtUt === false) {
      return {
        badge: "Ej aktuell",
        title: "Uthyrning av privatbostad",
        amountOre: 0,
        motivation: "Du har uppgett att du inte hyrt ut din bostad i år.",
        source: "Skatteverket — Uthyrning av privatbostad",
        needsReview: false,
      };
    }

    if (answers.harHyrtUt !== true) {
      return needsReview();
    }

    const hyresintaktKr = answers.hyresintaktKr;
    const faktiskKostnadKr = answers.uthyrningFaktiskKostnadKr;
    const redanRedovisat = answers.uthyrningRedanRedovisat;
    if (
      typeof hyresintaktKr !== "number" ||
      typeof faktiskKostnadKr !== "number" ||
      typeof redanRedovisat !== "boolean"
    ) {
      return needsReview();
    }

    if (redanRedovisat) {
      return {
        badge: "Redan hanterat",
        title: "Uthyrning av privatbostad",
        amountOre: 0,
        motivation:
          "Du har uppgett att avdraget redan är korrekt redovisat — inget extra att lägga till.",
        source: "Skatteverket — Uthyrning av privatbostad",
        needsReview: false,
      };
    }

    const hyresintaktOre = Math.round(hyresintaktKr * 100);
    const faktiskKostnadOre = Math.round(Math.max(faktiskKostnadKr, 0) * 100);
    const avdragOre = Math.min(
      SCHABLON_ORE + faktiskKostnadOre,
      hyresintaktOre,
    );
    const amountOre = Math.round(avdragOre * SKATTESATS);

    return {
      badge: amountOre > 0 ? "Avdrag hittat" : "Inget att hitta",
      title: "Uthyrning av privatbostad",
      amountOre,
      motivation:
        amountOre > 0
          ? "40 000 kr schablonavdrag plus egen avgift/hyra för uthyrningsperioden, beskattat med 30 % — inte redovisat, så justera din deklaration."
          : "Ingen hyresintäkt angiven att räkna på.",
      source: "Skatteverket — Uthyrning av privatbostad",
      needsReview: false,
    };
  },
};
