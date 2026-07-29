// @vitest-environment node
import { describe, expect, test } from "vitest";
import { POST } from "./route";

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/payments/mock/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments/mock/create", () => {
  test("creates a paid mock payment for a valid request", async () => {
    const response = await POST(
      postJson({ reportId: "report-1", amountOre: 250_000 }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("PAID");
    expect(typeof body.providerRef).toBe("string");
  });

  test("returns 400 when reportId is missing", async () => {
    const response = await POST(postJson({ amountOre: 250_000 }));
    expect(response.status).toBe(400);
  });

  test("returns 400 when amountOre isn't a number", async () => {
    const response = await POST(
      postJson({ reportId: "report-1", amountOre: "250000" }),
    );
    expect(response.status).toBe(400);
  });

  test("returns 400 for a malformed JSON body", async () => {
    const request = new Request("http://localhost/api/payments/mock/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
