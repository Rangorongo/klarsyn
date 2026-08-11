// Accuracy eval — mirrors apps/tullsyn's eval/ methodology: realistic,
// end-to-end scenarios with a hand-computed known-correct total (shown in
// each scenario's comment), run through the *real* production registry
// (buildFullRegistry, the same one src/app/interview/page.tsx uses) rather
// than individual rule units. Unit tests already cover each rule's
// branches in isolation — this file proves the whole system aggregates
// correctly across all ten rules at once, and gives a single trackable
// "success rate" number (see the summary test at the bottom) instead of a
// vibe. A regression in any rule that changes a real scenario's total will
// fail here even if that rule's own unit tests still pass in isolation.
import { describe, expect, test } from "vitest";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { computeAllResults } from "./allRules";
import type { AnswerMap } from "./types";

const underlag: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 35_000_000 };

// Every scenario answers every rule's gate question explicitly ("nej"/0)
// unless the scenario is specifically exercising that rule — so each
// scenario's total is attributable only to the rule(s) it's testing.
const ALL_NO: AnswerMap = {
  fardmedel: "kollektivt",
  kollektivtKostnadKr: 0,
  harDubbelBosattning: false,
  forsaljningsprisKr: 0,
  harRanteutgifter: false,
  rutRotAnvant: false,
  harSkanktGavor: false,
  harKapitalforlust: false,
  gronTeknikAnvant: false,
  harHyrtUt: false,
  harSaltBostadMedForlust: false,
};

interface Scenario {
  name: string;
  answers: AnswerMap;
  expectedTotalOre: number;
}

const scenarios: Scenario[] = [
  {
    name: "ingen har några avdrag",
    answers: ALL_NO,
    expectedTotalOre: 0,
  },
  {
    name: "pendlare med bil, kvalificerad för reseavdrag",
    // 30km * 2 * 220 dagar / 10 = 1,320 mil * 25 kr = 33,000 kr - 11,000 kr tröskel = 22,000 kr
    answers: {
      ...ALL_NO,
      fardmedel: "bil",
      avstandKm: 30,
      spararTid: true,
      arbetsdagarPerAr: 220,
    },
    expectedTotalOre: 2_200_000,
  },
  {
    name: "pendlare kollektivt under tröskeln — inget avdrag",
    answers: { ...ALL_NO, fardmedel: "kollektivt", kollektivtKostnadKr: 9_000 },
    expectedTotalOre: 0,
  },
  {
    name: "ränteavdrag, inte förifyllt",
    // 50,000 kr under 100,000 kr-tröskeln => 30% = 15,000 kr
    answers: {
      ...ALL_NO,
      harRanteutgifter: true,
      ranteutgifterKr: 50_000,
      ranteRedanForifyllt: false,
    },
    expectedTotalOre: 1_500_000,
  },
  {
    name: "RUT/ROT redan hanterat på fakturan — inget nytt att hitta",
    answers: {
      ...ALL_NO,
      rutRotAnvant: true,
      rutArbetskostnadKr: 5_000,
      rotArbetskostnadKr: 0,
      rutRotAvdragetTillampat: true,
    },
    expectedTotalOre: 0,
  },
  {
    name: "RUT/ROT inte tillämpat — hittat",
    // RUT: 8,000 * 50% = 4,000 kr. ROT: 20,000 * 30% = 6,000 kr. Summa 10,000 kr.
    answers: {
      ...ALL_NO,
      rutRotAnvant: true,
      rutArbetskostnadKr: 8_000,
      rotArbetskostnadKr: 20_000,
      rutRotAvdragetTillampat: false,
    },
    expectedTotalOre: 1_000_000,
  },
  {
    name: "gåvor över taket — kvalificerande belopp kapas vid 12 000 kr",
    // min(20 000, 12 000) * 25% = 3,000 kr
    answers: {
      ...ALL_NO,
      harSkanktGavor: true,
      gavobeloppKr: 20_000,
      gavorRedanForifyllt: false,
    },
    expectedTotalOre: 300_000,
  },
  {
    name: "kapitalförlust med kvarvarande nettoförlust",
    // Netto: 10,000 - 2,000 = 8,000 kr. Kvoterad 70% = 5,600 kr. 30% = 1,680 kr.
    answers: {
      ...ALL_NO,
      harKapitalforlust: true,
      kapitalforlustKr: 10_000,
      kapitalvinstKr: 2_000,
      kapitalforlustRedanForifyllt: false,
    },
    expectedTotalOre: 168_000,
  },
  {
    name: "grön teknik — solceller och batterilagring kombinerat",
    // Solceller: 50,000 * 15% = 7,500 kr. Lagring: 10,000 * 50% = 5,000 kr.
    answers: {
      ...ALL_NO,
      gronTeknikAnvant: true,
      solcellerKostnadKr: 50_000,
      lagringKostnadKr: 10_000,
      laddningKostnadKr: 0,
      gronTeknikAvdragetTillampat: false,
    },
    expectedTotalOre: 1_250_000,
  },
  {
    name: "dubbel bosättning, kvalificerad med alla komponenter",
    // Levnadskostnad: 25 * 87 kr = 2,175 kr. Logi: 8,000 kr. Hemresor: 8 * 600 kr = 4,800 kr.
    answers: {
      ...ALL_NO,
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 100,
      dagarForstaManaden: 25,
      logikostnadKr: 8_000,
      hemresorAntal: 8,
      hemresaKostnadKr: 600,
    },
    expectedTotalOre: 1_497_500,
  },
  {
    name: "dubbel bosättning, diskvalificerad under 50km",
    answers: {
      ...ALL_NO,
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 30,
    },
    expectedTotalOre: 0,
  },
  {
    name: "krypto — schablonmetoden slår känt omkostnadsbelopp",
    // Schablon: 50,000 * 20% = 10,000 kr > känt 5,000 kr. Extra avdrag 5,000 kr * 30% = 1,500 kr.
    answers: {
      ...ALL_NO,
      forsaljningsprisKr: 50_000,
      kandOmkostnadsbeloppKr: 5_000,
    },
    expectedTotalOre: 150_000,
  },
  {
    name: "uthyrning av privatbostad, inte redovisat",
    // Avdrag: 40,000 + 6,000 = 46,000 kr. 30% = 13,800 kr.
    answers: {
      ...ALL_NO,
      harHyrtUt: true,
      hyresintaktKr: 60_000,
      uthyrningBostadstyp: "bostadsratt",
      uthyrningFaktiskKostnadKr: 6_000,
      uthyrningRedanRedovisat: false,
    },
    expectedTotalOre: 1_380_000,
  },
  {
    name: "förlust vid bostadsförsäljning, äkta bostad",
    // Förlust 100,000 kr, kvoterad 50% = 50,000 kr. 30% = 15,000 kr.
    answers: {
      ...ALL_NO,
      harSaltBostadMedForlust: true,
      bostadsforlustKr: 100_000,
      oaktaBostadsratt: false,
      bostadsforlustRedanForifyllt: false,
    },
    expectedTotalOre: 1_500_000,
  },
  {
    name: "allt hittat samtidigt — full kombinerad session",
    // Summan av varje enskilt scenario ovan som faktiskt hittar något:
    // resor 2,200,000 + ränta 1,500,000 + rutRot 1,000,000 + gåvor 300,000
    // + kapitalförlust 168,000 + grön teknik 1,250,000
    // + dubbel bosättning 1,497,500 + krypto 150,000 + uthyrning 1,380,000
    // + bostadsförlust 1,500,000 = 10,945,500 öre
    answers: {
      fardmedel: "bil",
      avstandKm: 30,
      spararTid: true,
      arbetsdagarPerAr: 220,
      harDubbelBosattning: true,
      dubbelBosattningAvstandKm: 100,
      dagarForstaManaden: 25,
      logikostnadKr: 8_000,
      hemresorAntal: 8,
      hemresaKostnadKr: 600,
      forsaljningsprisKr: 50_000,
      kandOmkostnadsbeloppKr: 5_000,
      harRanteutgifter: true,
      ranteutgifterKr: 50_000,
      ranteRedanForifyllt: false,
      rutRotAnvant: true,
      rutArbetskostnadKr: 8_000,
      rotArbetskostnadKr: 20_000,
      rutRotAvdragetTillampat: false,
      harSkanktGavor: true,
      gavobeloppKr: 20_000,
      gavorRedanForifyllt: false,
      harKapitalforlust: true,
      kapitalforlustKr: 10_000,
      kapitalvinstKr: 2_000,
      kapitalforlustRedanForifyllt: false,
      gronTeknikAnvant: true,
      solcellerKostnadKr: 50_000,
      lagringKostnadKr: 10_000,
      laddningKostnadKr: 0,
      gronTeknikAvdragetTillampat: false,
      harHyrtUt: true,
      hyresintaktKr: 60_000,
      uthyrningBostadstyp: "bostadsratt",
      uthyrningFaktiskKostnadKr: 6_000,
      uthyrningRedanRedovisat: false,
      harSaltBostadMedForlust: true,
      bostadsforlustKr: 100_000,
      oaktaBostadsratt: false,
      bostadsforlustRedanForifyllt: false,
    },
    expectedTotalOre: 10_945_500,
  },
];

describe("accuracy eval — full registry against known-correct scenarios", () => {
  for (const scenario of scenarios) {
    test(scenario.name, () => {
      const { totalOre, results } = computeAllResults(underlag, scenario.answers);
      expect(totalOre, JSON.stringify(results, null, 1)).toBe(
        scenario.expectedTotalOre,
      );
    });
  }

  test("success rate summary", () => {
    const outcomes = scenarios.map((scenario) => {
      const { totalOre } = computeAllResults(underlag, scenario.answers);
      return totalOre === scenario.expectedTotalOre;
    });
    const passed = outcomes.filter(Boolean).length;
    // Not just documentation — this assertion is what actually fails CI if
    // the success rate regresses, independent of the per-scenario tests
    // above (kept as a second, coarser signal).
    expect(passed).toBe(scenarios.length);
  });
});
