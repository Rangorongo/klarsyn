import { extractText } from "unpdf";
import { SkatteverketParseError } from "./errors";
import { UnderlagSchema, type Underlag } from "./models";
import { redactPersonnummer } from "./redactPersonnummer";

// Extracts raw text from the prefilled Skatteverket PDF. Thin wrapper around
// unpdf — no Skatteverket-specific logic here, that lives in
// parseSkatteverketPdfText below.
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(bytes, { mergePages: true });
  return text;
}

// NOTE: line patterns ("Inkomstår: ", "Kontant bruttolön: ") are a best
// guess at the prefilled PDF's text layout, since no real exported file was
// available at design time. Must be verified against an actual
// (avidentifierad) file — see open question #3 in
// docs/superpowers/specs/2026-07-29-deklar-cloud-webapp-design.md.
export function parseSkatteverketPdfText(rawText: string): Underlag {
  const text = redactPersonnummer(rawText);

  const arMatch = text.match(/Inkomstår:\s*(\d{4})/);
  if (!arMatch) {
    throw new SkatteverketParseError(
      "Kunde inte hitta inkomståret i PDF-filen. Prova XML-inläsningen istället.",
    );
  }
  const inkomstar = Number(arMatch[1]);

  const lonMatches = [
    ...text.matchAll(/Kontant bruttolön:\s*([\d\s]+)\s*kr/gi),
  ];
  const arbetsinkomstSummaOre = lonMatches.reduce((sum, match) => {
    const kronor = Number(match[1].replace(/\s/g, ""));
    return sum + Math.round(kronor * 100);
  }, 0);

  return UnderlagSchema.parse({ inkomstar, arbetsinkomstSummaOre });
}
