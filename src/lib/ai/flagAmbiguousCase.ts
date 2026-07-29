import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AiOutputError } from "./errors";
import { AMBIGUOUS_CASE_PROMPT } from "./prompts/ambiguousCase";
import type { CreateMessage } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

const TOOL_NAME = "flagga_oklart_fall";

const FLAG_AMBIGUOUS_CASE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Flaggar om en beskriven situation kräver manuell granskning. Innehåller aldrig ett belopp.",
  input_schema: {
    type: "object",
    properties: {
      needsReview: {
        type: "boolean",
        description: "Om fallet är oklart nog att kräva manuell granskning.",
      },
      explanation: {
        type: "string",
        description: "Kort motivering till bedömningen.",
      },
    },
    required: ["needsReview", "explanation"],
  },
};

// No amount field at all — structurally impossible for a hallucinated
// figure to survive validation, even if the model includes one anyway.
const AmbiguousFlagSchema = z.object({
  needsReview: z.boolean(),
  explanation: z.string(),
});

export type AmbiguousFlag = z.infer<typeof AmbiguousFlagSchema>;

export async function flagAmbiguousCase(
  createMessage: CreateMessage,
  description: string,
): Promise<AmbiguousFlag> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 512,
    system: AMBIGUOUS_CASE_PROMPT,
    messages: [{ role: "user", content: description }],
    tools: [FLAG_AMBIGUOUS_CASE_TOOL],
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

  return AmbiguousFlagSchema.parse(toolUse.input);
}
