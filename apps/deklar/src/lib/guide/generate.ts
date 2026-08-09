import type { RuleResult } from "@/lib/rules/types";
import { buildDubbelBosattningGuide } from "./templates/dubbelBosattning";
import { buildGavorGuide } from "./templates/gavor";
import { buildKapitalforlustGuide } from "./templates/kapitalforlust";
import { buildKryptoGuide } from "./templates/krypto";
import { buildRantaGuide } from "./templates/ranta";
import { buildResorGuide } from "./templates/resor";
import { buildRutRotGuide } from "./templates/rutRot";
import type { GuideStep } from "./types";

const TEMPLATE_BY_RULE_ID: Record<
  string,
  (result: RuleResult) => GuideStep | null
> = {
  resor: buildResorGuide,
  dubbelBosattning: buildDubbelBosattningGuide,
  krypto: buildKryptoGuide,
  ranta: buildRantaGuide,
  rutRot: buildRutRotGuide,
  gavor: buildGavorGuide,
  kapitalforlust: buildKapitalforlustGuide,
};

export function generateGuide(
  ruleId: string,
  result: RuleResult,
): GuideStep | null {
  const template = TEMPLATE_BY_RULE_ID[ruleId];
  return template ? template(result) : null;
}
