import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket's published rules for 2026:
// https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut.4.2ef18e6a125660db8b080002674.html
const RUT_RATE = 0.5;
const ROT_RATE = 0.3;
const ROT_CAP_ORE = 50_000_00;
const COMBINED_CAP_ORE = 75_000_00;

const HAR_ANVANT_QUESTION: Question = {
  id: "rutRotAnvant",
  prompt:
    "Har du anlitat någon för hushållsnära tjänster (RUT) eller renovering/ombyggnad (ROT) under året?",
  type: "boolean",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
const RUT_KOSTNAD_QUESTION: Question = {
  id: "rutArbetskostnadKr",
  prompt:
    "Total arbetskostnad (exkl. material), RUT — t.ex. städning, trädgårdsarbete, barnpassning (kr). Ange 0 om inget.",
  type: "number",
};

const ROT_KOSTNAD_QUESTION: Question = {
  id: "rotArbetskostnadKr",
  prompt:
    "Total arbetskostnad (exkl. material), ROT — renovering/ombyggnad/tillbyggnad (kr). Ange 0 om inget.",
  type: "number",
};

const AVDRAGET_TILLAMPAT_QUESTION: Question = {
  id: "rutRotAvdragetTillampat",
  prompt:
    "Fick du avdraget direkt vid betalningen (dvs. betalade du ett lägre pris efter avdrag på fakturan)?",
  type: "boolean",
};

function beraknaKombineradReduktion(
  rutArbetskostnadOre: number,
  rotArbetskostnadOre: number,
): number {
  const rutReduktion = Math.round(rutArbetskostnadOre * RUT_RATE);
  const rotReduktion = Math.min(
    Math.round(rotArbetskostnadOre * ROT_RATE),
    ROT_CAP_ORE,
  );
  return Math.min(rutReduktion + rotReduktion, COMBINED_CAP_ORE);
}

export const rutRotRule: Rule = {
  id: "rutRot",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.rutRotAnvant === true) {
      return [
        HAR_ANVANT_QUESTION,
        RUT_KOSTNAD_QUESTION,
        ROT_KOSTNAD_QUESTION,
        AVDRAGET_TILLAMPAT_QUESTION,
      ];
    }
    return [HAR_ANVANT_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.rutRotAnvant === false) {
      return {
        badge: "Ej aktuell",
        title: "RUT- och ROT-avdrag",
        amountOre: 0,
        motivation: "Du har uppgett att du inte anlitat RUT- eller ROT-arbete i år.",
        source: "Skatteverket — Rot och rut",
        needsReview: false,
      };
    }

    if (answers.rutRotAnvant !== true) {
      return {
        badge: "Kräver mer information",
        title: "RUT- och ROT-avdrag",
        amountOre: null,
        motivation: "Svar saknas på om du anlitat RUT- eller ROT-arbete i år.",
        source: "Skatteverket — Rot och rut",
        needsReview: true,
      };
    }

    const rutArbetskostnadKr = answers.rutArbetskostnadKr;
    const rotArbetskostnadKr = answers.rotArbetskostnadKr;
    const avdragetTillampat = answers.rutRotAvdragetTillampat;
    if (
      typeof rutArbetskostnadKr !== "number" ||
      typeof rotArbetskostnadKr !== "number" ||
      typeof avdragetTillampat !== "boolean"
    ) {
      return {
        badge: "Kräver mer information",
        title: "RUT- och ROT-avdrag",
        amountOre: null,
        motivation: "Svar saknas för att beräkna RUT/ROT-reduktionen.",
        source: "Skatteverket — Rot och rut",
        needsReview: true,
      };
    }

    const kombineradReduktion = beraknaKombineradReduktion(
      Math.round(rutArbetskostnadKr * 100),
      Math.round(rotArbetskostnadKr * 100),
    );

    if (avdragetTillampat) {
      return {
        badge: "Redan hanterat",
        title: "RUT- och ROT-avdrag",
        amountOre: 0,
        motivation:
          "Du fick avdraget direkt på fakturan. Kontrollera själv att din sammanlagda RUT/ROT-skattereduktion för året inte överstiger taket på 75 000 kr (varav max 50 000 kr ROT), särskilt om du anlitat flera olika utförare.",
        source: "Skatteverket — Rot och rut",
        needsReview: false,
      };
    }

    return {
      badge: kombineradReduktion > 0 ? "Avdrag hittat" : "Inget att hitta",
      title: "RUT- och ROT-avdrag",
      amountOre: kombineradReduktion,
      motivation:
        kombineradReduktion > 0
          ? "Du betalade fullt pris utan avdrag på fakturan — du kan ansöka om detta i efterhand hos Skatteverket."
          : "Ingen arbetskostnad angiven att räkna på.",
      source: "Skatteverket — Rot och rut",
      needsReview: false,
    };
  },
};
