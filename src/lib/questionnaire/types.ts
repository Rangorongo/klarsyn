import type { Question } from "@/lib/rules/types";

export interface NextQuestionResult {
  // null once every applicable question across every candidate rule is answered.
  question: Question | null;
  ruleId: string | null;
  answeredCount: number;
  // "Fråga X av Y" denominator — recomputed every call, so it can grow or
  // shrink as branching answers reveal/hide questions.
  totalCount: number;
}
