import { describe, expect, test } from "vitest";
import { formatKr } from "./format";

describe("formatKr", () => {
  test("formats öre as whole kronor with Swedish thousands separator", () => {
    expect(formatKr(900_000)).toBe(`${(9000).toLocaleString("sv-SE")} kr`);
  });

  test("rounds to the nearest krona", () => {
    expect(formatKr(150)).toBe("2 kr");
  });

  test("formats zero", () => {
    expect(formatKr(0)).toBe("0 kr");
  });
});
