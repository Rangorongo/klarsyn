import { NextResponse } from "next/server";
import { createMockPaymentProvider } from "@/lib/payments/mockProvider";

// Dev/testing only — no live equivalent exists yet (see Öppna frågor in the
// design spec re: Swish/Klarna registration blockers). Never used in
// production.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON." }, { status: 400 });
  }

  const { reportId, amountOre } = (body ?? {}) as {
    reportId?: unknown;
    amountOre?: unknown;
  };

  if (typeof reportId !== "string" || typeof amountOre !== "number") {
    return NextResponse.json(
      { error: "reportId (string) och amountOre (number) krävs." },
      { status: 400 },
    );
  }

  const provider = createMockPaymentProvider("PAID");
  const result = await provider.create({ reportId, amountOre });

  return NextResponse.json(result);
}
