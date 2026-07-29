import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Schablonmetoden: omkostnadsbeloppet får alltid sättas till 20 % av
// försäljningspriset, oavsett faktisk anskaffningsutgift. Kapitalvinst
// beskattas med 30 %. Båda är stabila, generella skatteregler (till skillnad
// från resor/dubbelBosättnings årsvisa tröskelbelopp).
const SCHABLON_ANDEL = 0.2;
const KAPITALSKATT_ANDEL = 0.3;

const FORSALJNINGSPRIS_QUESTION: Question = {
  id: "forsaljningsprisOre",
  prompt:
    "Vad var det sammanlagda försäljningspriset (kr) för din kryptovaluta under året?",
  type: "number",
};

const KAND_OMKOSTNADSBELOPP_QUESTION: Question = {
  id: "kandOmkostnadsbeloppOre",
  prompt:
    "Vet du din faktiska anskaffningsutgift (kr)? Lämna tomt om du är osäker.",
  type: "number",
};

export const kryptoRule: Rule = {
  id: "krypto",

  // Crypto sales aren't part of Skatteverket's prefilled data — entirely
  // self-reported, so always a candidate.
  appliesTo(_underlag: Underlag): boolean {
    return true;
  },

  questions(_underlag: Underlag, _previousAnswers: AnswerMap): Question[] {
    return [FORSALJNINGSPRIS_QUESTION, KAND_OMKOSTNADSBELOPP_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    const forsaljningsprisOre = answers.forsaljningsprisOre;
    if (typeof forsaljningsprisOre !== "number") {
      return {
        badge: "Kräver mer information",
        title: "Krypto — schablonmetoden",
        amountOre: null,
        motivation:
          "Försäljningspris saknas för att beräkna omkostnadsbeloppet.",
        source: "Skatteverket — Schablonmetoden för kryptovaluta",
        needsReview: true,
      };
    }

    const kandOmkostnadsbeloppOre =
      typeof answers.kandOmkostnadsbeloppOre === "number"
        ? answers.kandOmkostnadsbeloppOre
        : 0;

    const schablonOmkostnadOre = Math.round(
      forsaljningsprisOre * SCHABLON_ANDEL,
    );
    const bastaOmkostnadOre = Math.max(
      schablonOmkostnadOre,
      kandOmkostnadsbeloppOre,
    );
    const extraAvdragOre = bastaOmkostnadOre - kandOmkostnadsbeloppOre;
    const skattebesparingOre = Math.round(extraAvdragOre * KAPITALSKATT_ANDEL);

    return {
      badge: skattebesparingOre > 0 ? "Avdrag hittat" : "Ingen extra besparing",
      title: "Krypto — schablonmetoden",
      amountOre: skattebesparingOre,
      motivation:
        skattebesparingOre > 0
          ? "Schablonmetoden (20 % av försäljningspriset) ger ett högre omkostnadsbelopp än vad du angett, vilket sänker din skatt."
          : "Ditt angivna omkostnadsbelopp är redan minst lika högt som schablonmetodens 20 %.",
      source: "Skatteverket — Schablonmetoden för kryptovaluta",
      needsReview: false,
    };
  },
};
