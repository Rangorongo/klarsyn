import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test, vi } from "vitest";
import { AiOutputError } from "./errors";
import { interpretResorFreeText } from "./interpretResorFreeText";
import type { CreateMessage } from "./types";

function fakeMessage(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return {
    id: "msg_test",
    container: null,
    content,
    model: "claude-haiku-4-5-20251001",
    role: "assistant",
    stop_details: null,
    stop_reason: "tool_use",
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

function toolUseBlock(input: unknown): Anthropic.ToolUseBlock {
  return {
    id: "toolu_test",
    caller: { type: "direct" },
    input,
    name: "extrahera_resor_svar",
    type: "tool_use",
  };
}

describe("interpretResorFreeText", () => {
  test("forces the extraction tool and returns the validated fields", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([
        toolUseBlock({
          avstandKm: 18,
          arbetsdagarPerAr: 210,
          fardmedel: "bil",
        }),
      ]),
    );

    const result = await interpretResorFreeText(
      createMessage,
      "Jag kör bil till jobbet, ca 18 km enkel väg, ungefär 210 dagar om året.",
    );

    expect(result).toEqual({
      avstandKm: 18,
      arbetsdagarPerAr: 210,
      fardmedel: "bil",
    });
    expect(createMessage).toHaveBeenCalledTimes(1);
    const params = (createMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.tool_choice).toEqual({
      type: "tool",
      name: "extrahera_resor_svar",
    });
  });

  test("returns only the fields the model was confident about", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([toolUseBlock({ fardmedel: "kollektivt" })]),
    );

    const result = await interpretResorFreeText(
      createMessage,
      "Jag åker kollektivt.",
    );

    expect(result).toEqual({ fardmedel: "kollektivt" });
  });

  test("throws AiOutputError when the model doesn't use the forced tool", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([{ type: "text", text: "Visst!", citations: null }]),
    );

    await expect(interpretResorFreeText(createMessage, "text")).rejects.toThrow(
      AiOutputError,
    );
  });

  test("rejects a malformed tool_use input instead of passing it through", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([toolUseBlock({ fardmedel: "flygande matta" })]),
    );

    await expect(
      interpretResorFreeText(createMessage, "text"),
    ).rejects.toThrow();
  });
});
