import { UnderlagSchema, type Underlag } from "./ingestion/skatteverket/models";

const STORAGE_KEY = "deklar:underlag";

// Interim hand-off between /upload and /interview until Phase 7 (auth +
// encrypted DB persistence) exists. Session-scoped, client-only, and
// re-validated on read since sessionStorage content is untrusted input.
export function readStoredUnderlag(): Underlag | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return UnderlagSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStoredUnderlag(underlag: Underlag): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(underlag));
}

export function clearStoredUnderlag(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
