// Matches Swedish personnummer/samordningsnummer: 6 or 8 digit birth date,
// optional separator (- or +, the latter marking 100+ years old), 4 check
// digits. Deliberately broad (no checksum validation) — for PII redaction,
// over-redacting a false positive is far safer than missing a real one.
const PERSONNUMMER_PATTERN = /\b(?:\d{8}|\d{6})[-+]?\d{4}\b/g;

export function redactPersonnummer(text: string): string {
  return text.replace(PERSONNUMMER_PATTERN, "[REDACTED]");
}
