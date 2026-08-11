import { beforeEach, describe, expect, test } from "vitest";
import type { Underlag } from "./ingestion/skatteverket/models";
import {
  clearAnswerTrail,
  readAnswerTrail,
  RULE_SET_VERSION,
  writeAnswerTrail,
  type AnswerTrailEntry,
} from "./answerTrail";

beforeEach(() => {
  sessionStorage.clear();
});

const underlag: Underlag = { inkomstar: 2025, arbetsinkomstSummaOre: 1 };

const entry: AnswerTrailEntry = {
  attestedAt: "2026-08-09T12:00:00.000Z",
  ruleSetVersion: RULE_SET_VERSION,
  underlag,
  answers: { fardmedel: "bil", avstandKm: 20, spararTid: true },
};

describe("answerTrail", () => {
  test("readAnswerTrail returns null when nothing has been stored", () => {
    expect(readAnswerTrail()).toBeNull();
  });

  test("round-trips a written entry, including mixed-type answers", () => {
    writeAnswerTrail(entry);
    expect(readAnswerTrail()).toEqual(entry);
  });

  test("returns null for corrupted (non-JSON) stored data", () => {
    sessionStorage.setItem("deklar:answerTrail", "not json");
    expect(readAnswerTrail()).toBeNull();
  });

  test("returns null for stored data that fails schema validation", () => {
    sessionStorage.setItem("deklar:answerTrail", JSON.stringify({ foo: "bar" }));
    expect(readAnswerTrail()).toBeNull();
  });

  test("clearAnswerTrail removes a previously written entry", () => {
    writeAnswerTrail(entry);
    clearAnswerTrail();
    expect(readAnswerTrail()).toBeNull();
  });

  test("round-trips an entry that includes sourceDocument", () => {
    const withSource: AnswerTrailEntry = {
      ...entry,
      sourceDocument: {
        name: "deklaration.pdf",
        hash: "a".repeat(64),
        sizeBytes: 12_345,
        storedAt: "2026-08-11T09:00:00.000Z",
      },
    };
    writeAnswerTrail(withSource);
    expect(readAnswerTrail()).toEqual(withSource);
  });

  test("round-trips an entry with sourceDocument explicitly null (example data)", () => {
    const withoutSource: AnswerTrailEntry = { ...entry, sourceDocument: null };
    writeAnswerTrail(withoutSource);
    expect(readAnswerTrail()).toEqual(withoutSource);
  });
});
