import { z } from "zod";

// Normalized, parsed Skatteverket data. Produced by the ingestion layer
// (XML/PDF parsers, Phase 3) and consumed by the rule engine. Never contains
// personnummer — see redactPersonnummer.ts (Phase 3).
export const UnderlagSchema = z.object({
  inkomstar: z.number().int(),
  arbetsinkomstSummaOre: z.number().int().nonnegative(),
});

export type Underlag = z.infer<typeof UnderlagSchema>;
