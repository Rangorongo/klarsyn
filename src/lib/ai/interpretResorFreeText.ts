import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AiOutputError } from "./errors";
import { RESOR_FREE_TEXT_PROMPT } from "./prompts/resorFreeText";
import type { CreateMessage } from "./types";

// Fast/cheap tier — appropriate for these bounded, low-complexity extraction
// tasks. Can be revisited independently of the task logic below.
const MODEL = "claude-haiku-4-5-20251001";

const TOOL_NAME = "extrahera_resor_svar";

const EXTRACT_RESOR_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Extraherar strukturerade svar om arbetsresor ur ett fritextsvar. Fyll bara i fält du är säker på.",
  input_schema: {
    type: "object",
    properties: {
      avstandKm: {
        type: "number",
        description: "Avstånd enkel väg mellan bostad och arbete, i km.",
      },
      arbetsdagarPerAr: {
        type: "number",
        description: "Antal dagar per år personen reser till arbetet.",
      },
      fardmedel: {
        type: "string",
        enum: ["bil", "kollektivt"],
        description: "Huvudsakligt färdmedel till arbetet.",
      },
    },
  },
};

// Only the fields resor.compute() consumes as input — never an amount. The
// AI extracts raw facts; the deterministic rule engine computes the result.
const ResorAnswerSchema = z.object({
  avstandKm: z.number().nonnegative().optional(),
  arbetsdagarPerAr: z.number().int().nonnegative().max(366).optional(),
  fardmedel: z.enum(["bil", "kollektivt"]).optional(),
});

export type ResorFreeTextAnswer = z.infer<typeof ResorAnswerSchema>;

export async function interpretResorFreeText(
  createMessage: CreateMessage,
  freeText: string,
): Promise<ResorFreeTextAnswer> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 512,
    system: RESOR_FREE_TEXT_PROMPT,
    messages: [{ role: "user", content: freeText }],
    tools: [EXTRACT_RESOR_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new AiOutputError(
      "Claude svarade inte med det tvingade verktygsanropet.",
    );
  }

  return ResorAnswerSchema.parse(toolUse.input);
}
