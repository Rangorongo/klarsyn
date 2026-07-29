import Anthropic from "@anthropic-ai/sdk";
import type { CreateMessage } from "./types";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment automatically.
  client ??= new Anthropic();
  return client;
}

// Thin wrapper around the SDK call — no Deklar-specific logic here. Every
// bounded AI task function takes a CreateMessage as a parameter instead of
// importing this directly, so tests can inject a fake.
export const createMessage: CreateMessage = (params) =>
  getClient().messages.create(params);
