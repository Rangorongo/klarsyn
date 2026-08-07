import type Anthropic from "@anthropic-ai/sdk";
import { GUIDE_TEXT_PROMPT } from "./prompts/guideText";
import type { CreateMessage } from "./types";
import { numbersMatchSource } from "./validateAiOutput";

const MODEL = "claude-haiku-4-5-20251001";

export async function polishGuideText(
  createMessage: CreateMessage,
  template: string,
  facts: Record<string, number>,
): Promise<string> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 512,
    system: GUIDE_TEXT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Mall:\n${template}\n\nFakta (får inte ändras):\n${JSON.stringify(facts)}`,
      },
    ],
  });

  const block = message.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!block) {
    return template;
  }

  const polished = block.text.trim();
  if (!numbersMatchSource(polished, Object.values(facts))) {
    return template;
  }

  return polished;
}
