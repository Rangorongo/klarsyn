# Design: Beslutsrapport — PDF som säljer sig själv i kunddemo

**Datum:** 2026-07-04
**Status:** Godkänd av Romeo (alternativ: Beslutsrapport)

## Syfte

Rapporten är det kunden ser. Den ska ge beslutsfattaren svaret på tre frågor
på första sidan: *Hur illa är det? Vad kan vi få tillbaka? Vad gör vi nu?*
— och därefter detaljerna för den som vill granska.

## Problem med dagens rapport

1. **Ingen sidbrytning** — med fler än ~5 varor skrivs innehållet utanför
   papperskanten (reportlab canvas ritar på fasta koordinater).
2. **Emoji i Arial** — Arial saknar emoji-glyfer; symbolerna riskerar att
   renderas som tomma rutor i PDF:en.
3. **Inga åtgärdsförslag** — kunden ser flaggor men inte vad hen ska GÖRA.
4. Långa flaggtexter klipps av efter 180 tecken.

## Lösning

### Åtgärdslista (customs_logic.py)

Nytt steg i `run_customs_audit`: bygger `final_output["action_items"]` —
lista av `{"prioritet": "hög"|"medel", "atgard": "..."}`, sorterad hög först.
Åtgärder härleds från signalerna:

| Signal | Åtgärd (prioritet) |
|--------|--------------------|
| AI: felklassificering | Låt tullombud verifiera HS-koden; omprövning kan begäras hos Tullverket upp till 3 år bakåt (hög) |
| HS-kod ej i TARIC | Rätta HS-koden — den finns inte i tulltaxan (hög) |
| Saknad HS-kod/ursprungsland | Komplettera fakturaunderlaget från leverantören (hög) |
| Räknefel (rad eller total) | Stäm av beloppen med leverantören (hög) |
| FTA-möjlighet med belopp (💶) | Begär ursprungsintyg (EUR.1/REX) och kontrollera om preferenstull yrkades i importdeklarationen (medel) |
| NAR | Låt tullombud beräkna den specifika tullsatsen (medel) |
| Låg konfidens/osäker matchning | Dubbelkolla varuraden mot originalfakturan (medel) |

Logiken ligger i customs_logic (affärslogik, kvotfritt testbar) — utils.py
presenterar den bara.

### PDF-struktur (utils.py — omskriven med reportlab platypus)

Platypus (`SimpleDocTemplate` + `Paragraph`/`Table`) ger automatiska
sidbrytningar och radbrytning av långa texter.

1. **Rubrik + fakturafakta** (nummer, datum, leverantör, valuta, totalbelopp)
2. **Slutdomsruta**: "X gröna · Y gula · Z röda" med färgade markörer
3. **Möjlig återbetalning (övre gräns)** + ansvarsfriskrivning
4. **Åtgärdslista** — numrerad, hög prioritet först, färgmarkerad
5. **Detaljer per vara** — färgad domrubrik (■ GRÖN/GUL/RÖD), varudata,
   TARIC-info, domskäl som punktlista
6. **Fullständig flagglista** sist

Emoji ersätts i PDF:en med texttaggar via mappning (⚠️→[SAKNAS], 🔴→[KRITISK],
💰→[MÖJLIGHET], 💶→[ÅTERBETALNING], 🔍→[MANUELL KONTROLL], 🧮→[RÄKNEFEL],
🟡→[OSÄKER]) — garanterat läsbart, professionellt intryck. CSV:n behåller
emoji (fungerar bra i Excel).

Domfärger: grön `#1a7f37`, gul `#b8860b`, röd `#c0392b`.

### Tester

- `test_customs_logic.py`: åtgärdslistan — röd vara ger hög-prioritetsåtgärd,
  💶-flagga ger ursprungsintygsåtgärd, felfri faktura ger tom lista,
  sortering hög före medel.
- `tests/test_utils.py` (NY): rök-test — bygger representativ fakturadata och
  kör `save_to_pdf` mot tmp-mapp; verifierar att filen skapas och inte är tom.
  Skippas automatiskt om Arial-fonterna saknas (icke-Windows).

## Avgränsningar

- CSV-exporten ändras inte.
- Ingen logotyp/grafisk profil ännu.
