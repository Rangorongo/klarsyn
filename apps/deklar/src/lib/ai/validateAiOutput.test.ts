import { describe, expect, test } from "vitest";
import { numbersMatchSource } from "./validateAiOutput";

describe("numbersMatchSource", () => {
  test("passes when every number in the text is a plain match", () => {
    expect(numbersMatchSource("Du sparar 600 kr.", [600, 30])).toBe(true);
  });

  test("passes for a number written with Swedish thousands-separator spacing", () => {
    expect(numbersMatchSource("Du sparar 9 000 kr.", [9000])).toBe(true);
  });

  test("fails when the text contains a number absent from the source", () => {
    expect(numbersMatchSource("Du sparar 700 kr.", [600])).toBe(false);
  });

  test("fails when a source number has been altered in the text", () => {
    // schablonmetoden always converts 20 % -> if the model writes 25 % instead,
    // that must be caught even though 20 itself never appears anywhere else.
    expect(numbersMatchSource("Med 25 % schablonavdrag...", [20, 30])).toBe(
      false,
    );
  });

  test("passes when the text has no numbers at all", () => {
    expect(numbersMatchSource("Inget belopp nämns här.", [600])).toBe(true);
  });

  test("handles a decimal-comma number matching a source value", () => {
    expect(numbersMatchSource("Skattesatsen är 30,5 procent.", [30.5])).toBe(
      true,
    );
  });

  test("fails a decimal-comma number not present in the source", () => {
    expect(numbersMatchSource("Skattesatsen är 30,5 procent.", [30])).toBe(
      false,
    );
  });
});
