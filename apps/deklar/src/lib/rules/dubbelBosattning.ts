import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { AnswerMap, Question, Rule, RuleResult } from "./types";

// Verified against Skatteverket for inkomstår 2025 (deklaration 2026):
// https://www.skatteverket.se/privat/skatter/arbeteochinkomst/avdragforprivatpersoner/d.4.5fc8c94513259a4ba1d800042835.html
// MAINTENANCE: the per-day schablonbelopp rises to 90 kr from inkomstår 2026
// (deklaration 2027).
//
// Simplifications (documented, not silently assumed):
// - The 87 kr/dag schablon only covers the FIRST MONTH of a temporary stay,
//   ever — not the first month of every tax year. We ask how many first-month
//   days fall within *this* tax year rather than tracking employment start
//   dates across years, which this app's Underlag doesn't model.
// - Housing (logi) has no schablon at all — only documented actual cost.
//   We trust the user's figure; the guide template tells them to keep proof.
// - The 2-year (5-year if sambo/gift with a working partner) time limit on
//   the whole deduction is NOT asked about — flagged in the motivation text
//   instead of gating on it, since tracking "years already claimed" needs
//   history this app doesn't have yet.
const SCHABLON_ORE_PER_DAG = 87_00;
const MAX_SCHABLON_DAGAR = 30;
const MINSTA_AVSTAND_KM = 50;

const HAR_DUBBEL_BOSATTNING_QUESTION: Question = {
  id: "harDubbelBosattning",
  prompt:
    "Bor du på en annan ort än din folkbokföringsadress på grund av ditt arbete, och övernattar du där?",
  type: "boolean",
};

const AVSTAND_QUESTION: Question = {
  id: "dubbelBosattningAvstandKm",
  prompt:
    "Hur långt är det (km, en väg) mellan din folkbokföringsadress och din arbetsort?",
  type: "number",
};

const DAGAR_FORSTA_MANADEN_QUESTION: Question = {
  id: "dagarForstaManaden",
  prompt:
    "Hur många dagar av din allra första månad på arbetsorten föll inom det här beskattningsåret? Ange 0 om den första månaden redan passerat under ett tidigare år.",
  type: "number",
};

// Answered in kr — converted to öre in compute(), matching rules/krypto.ts.
const LOGIKOSTNAD_QUESTION: Question = {
  id: "logikostnadKr",
  prompt:
    "Vad är dina faktiska, styrkta boendekostnader på arbetsorten under året (kr)? Ange 0 om du inte kan visa kvitto/hyresavi — utan underlag ges inget avdrag för boendet.",
  type: "number",
};

const HEMRESOR_ANTAL_QUESTION: Question = {
  id: "hemresorAntal",
  prompt:
    "Hur många hemresor till din folkbokföringsadress gjorde du under året? (Max en per vecka räknas.)",
  type: "number",
};

const HEMRESA_KOSTNAD_QUESTION: Question = {
  id: "hemresaKostnadKr",
  prompt: "Vad kostade en hemresa tur och retur i genomsnitt (kr)?",
  type: "number",
};

function needsReview(): RuleResult {
  return {
    badge: "Kräver mer information",
    title: "Dubbel bosättning",
    amountOre: null,
    motivation: "Svar saknas för att beräkna avdraget för dubbel bosättning.",
    source: "Skatteverket — Dubbel bosättning",
    needsReview: true,
  };
}

export const dubbelBosattningRule: Rule = {
  id: "dubbelBosattning",

  // Underlag (Skatteverket's prefilled data) has no signal for this — it's
  // entirely self-reported. Always a candidate so the interview question is
  // never silently skipped.
  appliesTo(_underlag: Underlag): boolean {
    return true;
  },

  questions(_underlag: Underlag, previousAnswers: AnswerMap): Question[] {
    if (previousAnswers.harDubbelBosattning !== true) {
      return [HAR_DUBBEL_BOSATTNING_QUESTION];
    }
    if (
      typeof previousAnswers.dubbelBosattningAvstandKm === "number" &&
      previousAnswers.dubbelBosattningAvstandKm < MINSTA_AVSTAND_KM
    ) {
      // Disqualified on distance alone — no need for the rest.
      return [HAR_DUBBEL_BOSATTNING_QUESTION, AVSTAND_QUESTION];
    }
    return [
      HAR_DUBBEL_BOSATTNING_QUESTION,
      AVSTAND_QUESTION,
      DAGAR_FORSTA_MANADEN_QUESTION,
      LOGIKOSTNAD_QUESTION,
      HEMRESOR_ANTAL_QUESTION,
      HEMRESA_KOSTNAD_QUESTION,
    ];
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

    if (answers.harDubbelBosattning !== true) {
      return needsReview();
    }

    const avstandKm = answers.dubbelBosattningAvstandKm;
    if (typeof avstandKm !== "number") {
      return needsReview();
    }
    if (avstandKm < MINSTA_AVSTAND_KM) {
      return {
        badge: "Uppfyller inte kraven",
        title: "Dubbel bosättning",
        amountOre: 0,
        motivation: `Avståndet måste vara längre än ${MINSTA_AVSTAND_KM} km för att dubbel bosättning ska ge avdrag.`,
        source: "Skatteverket — Dubbel bosättning",
        needsReview: false,
      };
    }

    const dagarForstaManaden = answers.dagarForstaManaden;
    const logikostnadKr = answers.logikostnadKr;
    const hemresorAntal = answers.hemresorAntal;
    const hemresaKostnadKr = answers.hemresaKostnadKr;
    if (
      typeof dagarForstaManaden !== "number" ||
      typeof logikostnadKr !== "number" ||
      typeof hemresorAntal !== "number" ||
      typeof hemresaKostnadKr !== "number"
    ) {
      return needsReview();
    }

    const levnadskostnadOre =
      Math.min(Math.max(dagarForstaManaden, 0), MAX_SCHABLON_DAGAR) *
      SCHABLON_ORE_PER_DAG;
    const logikostnadOre = Math.round(Math.max(logikostnadKr, 0) * 100);
    const hemresorOre = Math.round(
      Math.max(hemresorAntal, 0) * Math.max(hemresaKostnadKr, 0) * 100,
    );
    const amountOre = levnadskostnadOre + logikostnadOre + hemresorOre;

    return {
      badge: amountOre > 0 ? "Avdrag hittat" : "Inget att hitta",
      title: "Dubbel bosättning",
      amountOre,
      motivation:
        amountOre > 0
          ? `Ökade levnadskostnader (schablon, första månaden), styrkt boendekostnad och hemresor. Kom ihåg: avdraget är tidsbegränsat till 2 år (5 år om du är gift/sambo med en förvärvsarbetande partner) — kontrollera att du fortfarande är inom gränsen.`
          : "Inga kostnader angivna att räkna på.",
      source: "Skatteverket — Dubbel bosättning",
      needsReview: false,
    };
  },
};
