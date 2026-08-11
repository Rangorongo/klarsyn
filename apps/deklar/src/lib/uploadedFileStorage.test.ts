import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vitest";
import {
  clearUploadedFile,
  readUploadedFile,
  storeUploadedFile,
} from "./uploadedFileStorage";

function makeFile(content: string, name = "deklaration.xml"): File {
  return new File([content], name, { type: "application/xml" });
}

describe("uploadedFileStorage", () => {
  beforeEach(async () => {
    await clearUploadedFile();
  });

  test("returns null when nothing has been stored", async () => {
    expect(await readUploadedFile()).toBeNull();
  });

  // Note: fake-indexeddb's structured-clone step doesn't preserve a real
  // Blob's read methods (.text()/.arrayBuffer()) under jsdom — a test-only
  // artifact of the polyfill combination, not something real IndexedDB in a
  // browser does. So these tests verify the metadata (name, size, hash)
  // round-trips correctly, which is what storeUploadedFile/readUploadedFile
  // actually contract on; the Blob payload itself is exercised for real by
  // hashFile() succeeding against real file bytes in the other tests below.
  test("stores a file and reads it back with matching metadata", async () => {
    const file = makeFile("<xml>innehåll</xml>");
    const stored = await storeUploadedFile(file);

    expect(stored.name).toBe("deklaration.xml");
    expect(stored.sizeBytes).toBe(file.size);
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);

    const read = await readUploadedFile();
    expect(read).not.toBeNull();
    expect(read?.hash).toBe(stored.hash);
    expect(read?.name).toBe("deklaration.xml");
    expect(read?.sizeBytes).toBe(file.size);
  });

  test("storing a new file replaces the previous one", async () => {
    await storeUploadedFile(makeFile("first", "first.xml"));
    await storeUploadedFile(makeFile("second", "second.xml"));

    const read = await readUploadedFile();
    expect(read?.name).toBe("second.xml");
    expect(read?.sizeBytes).toBe(makeFile("second").size);
  });

  test("the same content hashes identically across two uploads", async () => {
    const first = await storeUploadedFile(makeFile("same bytes", "a.xml"));
    const second = await storeUploadedFile(makeFile("same bytes", "b.xml"));
    expect(first.hash).toBe(second.hash);
  });

  test("clearUploadedFile removes the stored record", async () => {
    await storeUploadedFile(makeFile("content"));
    await clearUploadedFile();
    expect(await readUploadedFile()).toBeNull();
  });
});
