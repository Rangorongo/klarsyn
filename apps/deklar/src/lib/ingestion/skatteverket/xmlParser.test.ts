import { describe, expect, test } from "vitest";
import { SkatteverketParseError } from "./errors";
import { parseSkatteverketXml } from "./xmlParser";

describe("parseSkatteverketXml", () => {
  test("parses a single Tjänst income into öre", () => {
    const xml = `<Inkomstdeklaration>
      <Inkomstar>2025</Inkomstar>
      <Inkomster>
        <Tjanst><KontantBruttolon>350000</KontantBruttolon></Tjanst>
      </Inkomster>
    </Inkomstdeklaration>`;

    expect(parseSkatteverketXml(xml)).toEqual({
      inkomstar: 2025,
      arbetsinkomstSummaOre: 35_000_000,
    });
  });

  test("sums multiple Tjänst entries (e.g. two employers)", () => {
    const xml = `<Inkomstdeklaration>
      <Inkomstar>2025</Inkomstar>
      <Inkomster>
        <Tjanst><KontantBruttolon>200000</KontantBruttolon></Tjanst>
        <Tjanst><KontantBruttolon>150000</KontantBruttolon></Tjanst>
      </Inkomster>
    </Inkomstdeklaration>`;

    expect(parseSkatteverketXml(xml).arbetsinkomstSummaOre).toBe(35_000_000);
  });

  test("treats a missing Inkomster block as zero employment income", () => {
    const xml = `<Inkomstdeklaration><Inkomstar>2025</Inkomstar></Inkomstdeklaration>`;

    expect(parseSkatteverketXml(xml)).toEqual({
      inkomstar: 2025,
      arbetsinkomstSummaOre: 0,
    });
  });

  test("throws a clear SkatteverketParseError when Inkomstar is missing", () => {
    const xml = `<Inkomstdeklaration>
      <Inkomster><Tjanst><KontantBruttolon>350000</KontantBruttolon></Tjanst></Inkomster>
    </Inkomstdeklaration>`;

    expect(() => parseSkatteverketXml(xml)).toThrow(SkatteverketParseError);
  });

  test("throws a clear SkatteverketParseError on unparseable XML", () => {
    expect(() => parseSkatteverketXml("not xml at all <<>>")).toThrow(
      SkatteverketParseError,
    );
  });

  test("never leaks a personnummer present in the source XML", () => {
    const xml = `<Inkomstdeklaration>
      <Inkomstar>2025</Inkomstar>
      <Personnummer>19900101-1234</Personnummer>
      <Inkomster><Tjanst><KontantBruttolon>350000</KontantBruttolon></Tjanst></Inkomster>
    </Inkomstdeklaration>`;

    const underlag = parseSkatteverketXml(xml);
    expect(JSON.stringify(underlag)).not.toContain("19900101-1234");
  });
});
