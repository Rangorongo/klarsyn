import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test, vi } from "vitest";
import { polishGuideText } from "./polishGuideText";
import type { CreateMessage } from "./types";

function fakeMessage(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return {
    id: "msg_test",
    container: null,
    content,
    model: "claude-haiku-4-5-20251001",
    role: "assistant",
    stop_details: null,
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 10,
      output_tokens: 10,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function textBlock(text: string): Anthropic.TextBlock {
  return { type: "text", text, citations: null };
}

const TEMPLATE = "Du kan spara 600 kr genom reseavdrag.";
const FACTS = { besparingKr: 600 };

describe("polishGuideText", () => {
  test("returns the polished text when every number matches the source facts", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([
        textBlock("Genom reseavdraget sparar du hela 600 kr i skatt."),
      ]),
    );

    const result = await polishGuideText(createMessage, TEMPLATE, FACTS);

    expect(result).toBe("Genom reseavdraget sparar du hela 600 kr i skatt.");
  });

  test("falls back to the raw template when the model alters a number", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([
        textBlock("Genom reseavdraget sparar du hela 6 000 kr i skatt."),
      ]),
    );

    const result = await polishGuideText(createMessage, TEMPLATE, FACTS);

    expect(result).toBe(TEMPLATE);
  });

  test("falls back to the raw template when there's no text block at all", async () => {
    const createMessage: CreateMessage = vi.fn(async () => fakeMessage([]));

    const result = await polishGuideText(createMessage, TEMPLATE, FACTS);

    expect(result).toBe(TEMPLATE);
  });
});
