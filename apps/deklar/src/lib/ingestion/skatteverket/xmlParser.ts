import { XMLParser } from "fast-xml-parser";
import { SkatteverketParseError } from "./errors";
import { UnderlagSchema, type Underlag } from "./models";
import { redactPersonnummer } from "./redactPersonnummer";

const parser = new XMLParser();

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// NOTE: field names (Inkomstdeklaration/Inkomstar/Inkomster/Tjanst/
// KontantBruttolon) are built against Skatteverket's public schema
// documentation, since no real exported file was available at design time.
// Must be verified against an actual (avidentifierad) file — see open
// question #3 in docs/superpowers/specs/2026-07-29-deklar-cloud-webapp-design.md.
export function parseSkatteverketXml(xml: string): Underlag {
  const redacted = redactPersonnummer(xml);

  let raw: Record<string, unknown>;
  try {
    raw = parser.parse(redacted);
  } catch {
    throw new SkatteverketParseError(
      "Kunde inte tolka XML-filen. Prova PDF-inläsningen istället.",
    );
  }

  const root = (raw?.Inkomstdeklaration ?? {}) as Record<string, unknown>;
  const inkomstar = Number(root.Inkomstar);
  if (!Number.isInteger(inkomstar)) {
    throw new SkatteverketParseError(
      "XML-filen saknar ett giltigt inkomstår. Prova PDF-inläsningen istället.",
    );
  }

  const inkomster = (root.Inkomster ?? {}) as Record<string, unknown>;
  const tjanstNoder = toArray(
    inkomster.Tjanst as
      Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const arbetsinkomstSummaOre = tjanstNoder.reduce((sum, node) => {
    const kronor = Number(node?.KontantBruttolon ?? 0);
    return sum + Math.round(kronor * 100);
  }, 0);

  return UnderlagSchema.parse({ inkomstar, arbetsinkomstSummaOre });
}
