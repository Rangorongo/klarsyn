// Matches Swedish-formatted numbers: digit groups optionally separated by
// spaces (thousands separator, e.g. "9 000"), with an optional decimal comma.
const NUMBER_PATTERN = /\d[\d\s]*(?:,\d+)?/g;

function extractNumbers(text: string): number[] {
  const matches = text.match(NUMBER_PATTERN) ?? [];
  return matches
    .map((match) => match.replace(/\s/g, "").replace(",", "."))
    .map(Number)
    .filter((value) => !Number.isNaN(value));
}

// Guards AI-polished guide text against hallucinated or altered figures:
// every number the model wrote must appear, verbatim, among the trusted
// source data it was given as fixed input.
export function numbersMatchSource(
  text: string,
  sourceNumbers: number[],
): boolean {
  const found = extractNumbers(text);
  const allowed = new Set(sourceNumbers.map(String));
  return found.every((value) => allowed.has(String(value)));
}
