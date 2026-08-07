import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test, vi } from "vitest";
import { AiOutputError } from "./errors";
import { flagAmbiguousCase } from "./flagAmbiguousCase";
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
    name: "flagga_oklart_fall",
    type: "tool_use",
  };
}

describe("flagAmbiguousCase", () => {
  test("forces the flagging tool and returns needsReview + explanation", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([
        toolUseBlock({
          needsReview: true,
          explanation: "Distans och boendekostnad saknas i beskrivningen.",
        }),
      ]),
    );

    const result = await flagAmbiguousCase(
      createMessage,
      "Jag bor ibland hos min sambo i en annan stad.",
    );

    expect(result).toEqual({
      needsReview: true,
      explanation: "Distans och boendekostnad saknas i beskrivningen.",
    });
    const params = (createMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.tool_choice).toEqual({
      type: "tool",
      name: "flagga_oklart_fall",
    });
  });

  test("never lets an amount field leak through, even if the model includes one", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([
        toolUseBlock({
          needsReview: false,
          explanation: "Tydligt fall.",
          amount: 12000, // schema has no such field — must be stripped, not trusted
        }),
      ]),
    );

    const result = await flagAmbiguousCase(createMessage, "text");

    expect(result).toEqual({
      needsReview: false,
      explanation: "Tydligt fall.",
    });
    expect(result).not.toHaveProperty("amount");
  });

  test("throws AiOutputError when the model doesn't use the forced tool", async () => {
    const createMessage: CreateMessage = vi.fn(async () =>
      fakeMessage([{ type: "text", text: "Visst!", citations: null }]),
    );

    await expect(flagAmbiguousCase(createMessage, "text")).rejects.toThrow(
      AiOutputError,
    );
  });
});
