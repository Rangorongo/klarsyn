import { describe, expect, test } from "vitest";
import { createMockPaymentProvider } from "./mockProvider";

describe("createMockPaymentProvider", () => {
  test("defaults to a PAID outcome", async () => {
    const provider = createMockPaymentProvider();
    const result = await provider.create({
      reportId: "report-1",
      amountOre: 250_000,
    });

    expect(result.status).toBe("PAID");
    expect(typeof result.providerRef).toBe("string");
    expect(result.providerRef.length).toBeGreaterThan(0);
  });

  test("respects a configured DECLINED outcome", async () => {
    const provider = createMockPaymentProvider("DECLINED");
    const result = await provider.create({
      reportId: "report-1",
      amountOre: 250_000,
    });

    expect(result.status).toBe("DECLINED");
  });

  test("produces a unique providerRef per call", async () => {
    const provider = createMockPaymentProvider();
    const a = await provider.create({ reportId: "report-1", amountOre: 100 });
    const b = await provider.create({ reportId: "report-1", amountOre: 100 });

    expect(a.providerRef).not.toBe(b.providerRef);
  });

  test("handleCallback normalizes a valid payload to the configured status", async () => {
    const provider = createMockPaymentProvider("PAID");

    const result = await provider.handleCallback({
      providerRef: "mock_report-1_123",
    });

    expect(result).toEqual({
      providerRef: "mock_report-1_123",
      status: "PAID",
    });
  });

  test("handleCallback rejects a malformed payload", async () => {
    const provider = createMockPaymentProvider();

    await expect(provider.handleCallback({})).rejects.toThrow();
    await expect(provider.handleCallback(null)).rejects.toThrow();
    await expect(provider.handleCallback("not an object")).rejects.toThrow();
  });
});
