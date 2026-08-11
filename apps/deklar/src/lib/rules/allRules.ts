import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { bostadsforlustRule } from "./bostadsforlust";
import { dubbelBosattningRule } from "./dubbelBosattning";
import { gavorRule } from "./gavor";
import { gronTeknikRule } from "./gronTeknik";
import { kapitalforlustRule } from "./kapitalforlust";
import { kryptoRule } from "./krypto";
import { rantaRule } from "./ranta";
import { RuleRegistry } from "./registry";
import { resorRule } from "./resor";
import { rutRotRule } from "./rutRot";
import type { AnswerMap, RuleResult } from "./types";
import { uthyrningRule } from "./uthyrning";

// Single source of truth for "every rule the product currently implements" —
// used by both the interview flow (src/app/interview/page.tsx) and the
// accuracy eval (eval.test.ts), so the two can never silently drift apart.
export function buildFullRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.register(resorRule);
  registry.register(dubbelBosattningRule);
  registry.register(kryptoRule);
  registry.register(rantaRule);
  registry.register(rutRotRule);
  registry.register(gavorRule);
  registry.register(kapitalforlustRule);
  registry.register(gronTeknikRule);
  registry.register(uthyrningRule);
  registry.register(bostadsforlustRule);
  return registry;
}

export interface ComputedReport {
  results: { ruleId: string; result: RuleResult }[];
  totalOre: number;
}

// Runs every applicable rule against one Underlag + AnswerMap and totals the
// result — the same aggregation the interview flow and the accuracy eval
// both need, kept in one place so they can't drift apart.
export function computeAllResults(
  underlag: Underlag,
  answers: AnswerMap,
): ComputedReport {
  const registry = buildFullRegistry();
  const results = registry
    .getApplicable(underlag)
    .map((rule) => ({ ruleId: rule.id, result: rule.compute(underlag, answers) }));
  const totalOre = results.reduce(
    (sum, { result }) => sum + (result.amountOre ?? 0),
    0,
  );
  return { results, totalOre };
}

export const RULE_CATEGORY_LABEL: Record<string, string> = {
  resor: "Resor till jobbet",
  dubbelBosattning: "Dubbel bosättning",
  krypto: "Krypto",
  ranta: "Ränta & kapital",
  rutRot: "RUT & ROT",
  gavor: "Gåvor till välgörenhet",
  kapitalforlust: "Kapitalförlust — aktier och fonder",
  gronTeknik: "Grön teknik",
  uthyrning: "Uthyrning av privatbostad",
  bostadsforlust: "Förlust vid bostadsförsäljning",
};
