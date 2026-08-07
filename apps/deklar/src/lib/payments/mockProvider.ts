import { randomUUID } from "node:crypto";
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentCallbackResult,
  PaymentProvider,
  PaymentStatus,
} from "./types";

// Simulates a payment provider for local dev/testing, with no real Swish or
// Klarna credentials. Never used in production — see the open item in the
// design spec about real Swish/Klarna integration blocking on external
// business registration (Swedish org.nr, bank-issued Swish number, Klarna
// merchant agreement).
export function createMockPaymentProvider(
  outcome: PaymentStatus = "PAID",
): PaymentProvider {
  return {
    id: "mock",

    async create(params: CreatePaymentParams): Promise<CreatePaymentResult> {
      return {
        providerRef: `mock_${params.reportId}_${randomUUID()}`,
        status: outcome,
      };
    },

    async handleCallback(payload: unknown): Promise<PaymentCallbackResult> {
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("providerRef" in payload) ||
        typeof (payload as { providerRef: unknown }).providerRef !== "string"
      ) {
        throw new Error("Ogiltig callback-payload.");
      }

      return {
        providerRef: (payload as { providerRef: string }).providerRef,
        status: outcome,
      };
    },
  };
}
