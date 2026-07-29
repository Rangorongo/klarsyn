import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { Rule } from "./types";

export class RuleRegistry {
  private rules: Rule[] = [];

  register(rule: Rule): void {
    this.rules.push(rule);
  }

  getApplicable(underlag: Underlag): Rule[] {
    return this.rules.filter((rule) => rule.appliesTo(underlag));
  }
}
