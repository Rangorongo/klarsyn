// @vitest-environment node
// Route handlers run server-side under Node's undici Request/FormData/File,
// not jsdom's — mixing the two causes internal webidl checks to fail.
import { describe, expect, test } from "vitest";
import { POST } from "./route";

const VALID_XML = `<Inkomstdeklaration>
  <Inkomstar>2025</Inkomstar>
  <Inkomster>
    <Tjanst><KontantBruttolon>350000</KontantBruttolon></Tjanst>
  </Inkomster>
</Inkomstdeklaration>`;

const BROKEN_XML = `<Inkomstdeklaration>
  <Inkomster><Tjanst><KontantBruttolon>350000</KontantBruttolon></Tjanst></Inkomster>
</Inkomstdeklaration>`;

function postWithFile(file: File | null): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/upload", () => {
  test("parses a valid Skatteverket XML file into an Underlag", async () => {
    const file = new File([VALID_XML], "deklaration.xml", {
      type: "text/xml",
    });

    const response = await POST(postWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      underlag: { inkomstar: 2025, arbetsinkomstSummaOre: 35_000_000 },
    });
  });

  test("returns 400 when no file is attached", async () => {
    const response = await POST(postWithFile(null));

    expect(response.status).toBe(400);
  });

  test("returns 400 for an unsupported file type", async () => {
    const file = new File(["hej"], "deklaration.txt", {
      type: "text/plain",
    });

    const response = await POST(postWithFile(file));

    expect(response.status).toBe(400);
  });

  test("returns a clear error, not a raw stacktrace, when the XML is broken", async () => {
    const file = new File([BROKEN_XML], "deklaration.xml", {
      type: "text/xml",
    });

    const response = await POST(postWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});
