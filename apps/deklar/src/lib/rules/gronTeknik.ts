import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket for inkomstår 2025 (still active — separate
// from mikroproduktion av förnybar el, which is discontinued from 2026):
// https://www.skatteverket.se/privat/fastigheterochbostad/gronteknik.4.676f4884175c97df4192860.html
const SOLCELLER_RATE = 0.15;
const LAGRING_RATE = 0.5;
const LADDNING_RATE = 0.5;
const COMBINED_CAP_ORE = 50_000_00;

const HAR_ANVANT_QUESTION: Question = {
  id: "gronTeknikAnvant",
  prompt:
    "Har du installerat solceller, batterilagring för egenproducerad el, eller en laddningspunkt för elbil under året?",
  type: "boolean",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
const SOLCELLER_KOSTNAD_QUESTION: Question = {
  id: "solcellerKostnadKr",
  prompt:
    "Total kostnad (arbete + material) för solcellsinstallation (kr). Ange 0 om inget.",
  type: "number",
};

const LAGRING_KOSTNAD_QUESTION: Question = {
  id: "lagringKostnadKr",
  prompt:
    "Total kostnad för installation av batterilagring av egenproducerad el (kr). Ange 0 om inget.",
  type: "number",
};

const LADDNING_KOSTNAD_QUESTION: Question = {
  id: "laddningKostnadKr",
  prompt:
    "Total kostnad för installation av laddningspunkt för elbil (kr). Ange 0 om inget.",
  type: "number",
};

const AVDRAGET_TILLAMPAT_QUESTION: Question = {
  id: "gronTeknikAvdragetTillampat",
  prompt:
    "Fick du avdraget direkt vid betalningen (dvs. betalade du ett lägre pris efter avdrag på fakturan)?",
  type: "boolean",
};

function beraknaKombineradReduktion(
  solcellerKr: number,
  lagringKr: number,
  laddningKr: number,
): number {
  const solcellerReduktion = Math.round(solcellerKr * 100 * SOLCELLER_RATE);
  const lagringReduktion = Math.round(lagringKr * 100 * LAGRING_RATE);
  const laddningReduktion = Math.round(laddningKr * 100 * LADDNING_RATE);
  return Math.min(
    solcellerReduktion + lagringReduktion + laddningReduktion,
    COMBINED_CAP_ORE,
  );
}

function needsReview(): RuleResult {
  return {
    badge: "Kräver mer information",
    title: "Grön teknik",
    amountOre: null,
    motivation: "Svar saknas för att beräkna skattereduktionen.",
    source: "Skatteverket — Grön teknik",
    needsReview: true,
  };
}

export const gronTeknikRule: Rule = {
  id: "gronTeknik",

  appliesTo(underlag: Underlag): boolean {
    return underlag.arbetsinkomstSummaOre > 0;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.gronTeknikAnvant === true) {
      return [
        HAR_ANVANT_QUESTION,
        SOLCELLER_KOSTNAD_QUESTION,
        LAGRING_KOSTNAD_QUESTION,
        LADDNING_KOSTNAD_QUESTION,
        AVDRAGET_TILLAMPAT_QUESTION,
      ];
    }
    return [HAR_ANVANT_QUESTION];
  },

  compute(_underlag: Underlag, answers: AnswerMap): RuleResult {
    if (answers.gronTeknikAnvant === false) {
      return {
        badge: "Ej aktuell",
        title: "Grön teknik",
        amountOre: 0,
        motivation:
          "Du har uppgett att du inte installerat grön teknik i år.",
        source: "Skatteverket — Grön teknik",
        needsReview: false,
      };
    }

    if (answers.gronTeknikAnvant !== true) {
      return needsReview();
    }

    const solcellerKr = answers.solcellerKostnadKr;
    const lagringKr = answers.lagringKostnadKr;
    const laddningKr = answers.laddningKostnadKr;
    const avdragetTillampat = answers.gronTeknikAvdragetTillampat;
    if (
      typeof solcellerKr !== "number" ||
      typeof lagringKr !== "number" ||
      typeof laddningKr !== "number" ||
      typeof avdragetTillampat !== "boolean"
    ) {
      return needsReview();
    }

    const kombineradReduktion = beraknaKombineradReduktion(
      solcellerKr,
      lagringKr,
      laddningKr,
    );

    if (avdragetTillampat) {
      return {
        badge: "Redan hanterat",
        title: "Grön teknik",
        amountOre: 0,
        motivation:
          "Du fick avdraget direkt på fakturan. Kontrollera själv att din sammanlagda skattereduktion för grön teknik inte överstiger taket på 50 000 kr per år.",
        source: "Skatteverket — Grön teknik",
        needsReview: false,
      };
    }

    return {
      badge: kombineradReduktion > 0 ? "Avdrag hittat" : "Inget att hitta",
      title: "Grön teknik",
      amountOre: kombineradReduktion,
      motivation:
        kombineradReduktion > 0
          ? "Du betalade fullt pris utan avdrag på fakturan — du kan ansöka om detta i efterhand hos Skatteverket."
          : "Ingen installationskostnad angiven att räkna på.",
      source: "Skatteverket — Grön teknik",
      needsReview: false,
    };
  },
};
