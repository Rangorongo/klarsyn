import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import type { RuleRegistry } from "@/lib/rules/registry";
import type { AnswerMap, Question } from "@/lib/rules/types";
import type { NextQuestionResult } from "./types";

// Pull-based, recomputed every call — never a precomputed static tree.
export function getNextQuestion(
  registry: RuleRegistry,
  underlag: Underlag,
  answers: AnswerMap,
): NextQuestionResult {
  let totalCount = 0;
  let answeredCount = 0;
  let next: { ruleId: string; question: Question } | null = null;

  for (const rule of registry.getApplicable(underlag)) {
    for (const question of rule.questions(underlag, answers)) {
      totalCount += 1;
      if (Object.hasOwn(answers, question.id)) {
        answeredCount += 1;
      } else if (!next) {
        next = { ruleId: rule.id, question };
      }
    }
  }

  return {
    question: next?.question ?? null,
    ruleId: next?.ruleId ?? null,
    answeredCount,
    totalCount,
  };
}
