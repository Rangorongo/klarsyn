import type Anthropic from "@anthropic-ai/sdk";

// Dependency-injection seam: every bounded AI task function takes this
// instead of calling the SDK directly, so tests can supply a fake response
// without a live API key or network access.
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;
