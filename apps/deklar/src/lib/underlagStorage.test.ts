import { beforeEach, describe, expect, test } from "vitest";
import type { Underlag } from "./ingestion/skatteverket/models";
import {
  clearStoredUnderlag,
  readStoredUnderlag,
  writeStoredUnderlag,
} from "./underlagStorage";

beforeEach(() => {
  sessionStorage.clear();
});

const underlag: Underlag = {
  inkomstar: 2025,
  arbetsinkomstSummaOre: 35_000_000,
};

describe("underlagStorage", () => {
  test("readStoredUnderlag returns null when nothing has been stored", () => {
    expect(readStoredUnderlag()).toBeNull();
  });

  test("round-trips a written Underlag", () => {
    writeStoredUnderlag(underlag);
    expect(readStoredUnderlag()).toEqual(underlag);
  });

  test("returns null for corrupted (non-JSON) stored data", () => {
    sessionStorage.setItem("deklar:underlag", "not json");
    expect(readStoredUnderlag()).toBeNull();
  });

  test("returns null for stored data that fails Underlag validation", () => {
    sessionStorage.setItem("deklar:underlag", JSON.stringify({ foo: "bar" }));
    expect(readStoredUnderlag()).toBeNull();
  });

  test("clearStoredUnderlag removes a previously written value", () => {
    writeStoredUnderlag(underlag);
    clearStoredUnderlag();
    expect(readStoredUnderlag()).toBeNull();
  });
});
