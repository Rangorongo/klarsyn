import type { Underlag } from "@/lib/ingestion/skatteverket/models";

export type AnswerValue = string | number | boolean;

// Keyed by Question.id.
export type AnswerMap = Record<string, AnswerValue>;

export interface Question {
  id: string;
  prompt: string;
  type: "text" | "number" | "boolean";
}

export interface RuleResult {
  badge: string;
  title: string;
  // null only when the item is genuinely non-numeric without manual review
  // (e.g. dubbelBosattning). A missing/invalid required answer must produce
  // needsReview: true, never a silent 0.
  amountOre: number | null;
  motivation: string;
  // Citation into Skatteverket's regelverk.
  source: string;
  needsReview: boolean;
}

export interface Rule {
  id: string;
  // Is this rule even a candidate given the parsed Skatteverket data alone
  // (before any interview answers exist)?
  appliesTo(underlag: Underlag): boolean;
  // Candidate questions for the current answer state; may branch based on
  // previousAnswers. The questionnaire engine (Phase 4) picks the next
  // unanswered one from this list.
  questions(underlag: Underlag, previousAnswers: AnswerMap): Question[];
  compute(underlag: Underlag, answers: AnswerMap): RuleResult;
}
