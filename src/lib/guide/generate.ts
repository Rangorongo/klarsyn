import type { RuleResult } from "@/lib/rules/types";
import { buildDubbelBosattningGuide } from "./templates/dubbelBosattning";
import { buildKryptoGuide } from "./templates/krypto";
import { buildResorGuide } from "./templates/resor";
import type { GuideStep } from "./types";

const TEMPLATE_BY_RULE_ID: Record<
  string,
  (result: RuleResult) => GuideStep | null
> = {
  resor: buildResorGuide,
  dubbelBosattning: buildDubbelBosattningGuide,
  krypto: buildKryptoGuide,
};

export function generateGuide(
  ruleId: string,
  result: RuleResult,
): GuideStep | null {
  const template = TEMPLATE_BY_RULE_ID[ruleId];
  return template ? template(result) : null;
}
