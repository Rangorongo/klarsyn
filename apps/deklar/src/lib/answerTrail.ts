import { z } from "zod";
import { UnderlagSchema } from "./ingestion/skatteverket/models";

// Bump when a rule's figures or logic change materially (see
// docs/strategi-risker-och-krav.md #1 — skatteregler ändras årligen).
// Recorded in the trail so a past attestation can be tied back to the rule
// version that produced it.
export const RULE_SET_VERSION = "2026-08-11";

const STORAGE_KEY = "deklar:answerTrail";

const SourceDocumentSchema = z.object({
  name: z.string(),
  hash: z.string(),
  sizeBytes: z.number(),
  storedAt: z.string(),
});

const AnswerTrailSchema = z.object({
  attestedAt: z.string(),
  ruleSetVersion: z.string(),
  underlag: UnderlagSchema,
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  // Ties this trail to the exact uploaded declaration it was based on (see
  // uploadedFileStorage.ts) — absent when the session used example data
  // instead of a real upload. Only the hash + metadata live here; the file
  // bytes themselves stay in uploadedFileStorage's own IndexedDB record.
  sourceDocument: SourceDocumentSchema.nullable().optional(),
});

export type AnswerTrailEntry = z.infer<typeof AnswerTrailSchema>;

// PROTOTYPE STORAGE — same caveat as underlagStorage.ts: this is a
// client-only, unencrypted, browser-session-scoped record. It captures the
// *shape* the real audit trail needs (timestamped, versioned, tied to the
// exact answers given) so the migration to real encrypted server-side
// persistence (Phase 7 — an AnswerSet-style table, see prisma/schema.prisma)
// is a storage-layer swap, not a data-model rework. It is NOT yet durable or
// tamper-evident enough to rely on as real evidence in a dispute — the user
// can clear it, and no server ever sees it. See docs/strategi-risker-och-krav.md.
export function writeAnswerTrail(entry: AnswerTrailEntry): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export function readAnswerTrail(): AnswerTrailEntry | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return AnswerTrailSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearAnswerTrail(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
