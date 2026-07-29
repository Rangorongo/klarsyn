// Mirrors prisma/schema.prisma's PaymentStatus enum.
export type PaymentStatus =
  "CREATED" | "PENDING" | "PAID" | "DECLINED" | "FAILED";

export interface CreatePaymentParams {
  reportId: string;
  amountOre: number;
}

export interface CreatePaymentResult {
  providerRef: string;
  status: PaymentStatus;
  // Where to send the user to complete payment (hosted checkout / Swish app
  // open). Not every provider needs one — the mock provider completes
  // instantly and has none.
  redirectUrl?: string;
}

export interface PaymentCallbackResult {
  providerRef: string;
  status: PaymentStatus;
}

// One interface, separate concrete clients per provider (Swish/Klarna are
// structurally different APIs) — per the design spec's payments section.
export interface PaymentProvider {
  readonly id: string;
  create(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  // Verifies and parses a provider webhook/callback payload into a
  // normalized result.
  handleCallback(payload: unknown): Promise<PaymentCallbackResult>;
}
