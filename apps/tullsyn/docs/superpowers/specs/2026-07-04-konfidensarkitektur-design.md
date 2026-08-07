# Design: Konfidensarkitekturen — slutdom per vara

**Datum:** 2026-07-04
**Status:** Godkänd av Romeo (alternativ: signaler + 1 AI-verifiering)

## Syfte

Varje vara ska få en **slutdom** som kunden direkt förstår:

- 🟢 **grön** — alla kontroller överens, lita på resultatet
- 🟡 **gul** — något är osäkert, bör granskas av människa
- 🔴 **röd** — motsägelse eller blockerande fel, måste granskas

Målet "nära 100 % korrekt" nås genom dubbelkontroll: TARIC-fakta (deterministiskt)
+ AI-bedömning (nyanser) — aldrig via AI ensam.

## Signaler som bygger domen

| Signal | Källa | Kvotkostnad |
|--------|-------|-------------|
| Räknefel på raden (🧮) | aritmetikkontroll | 0 |
| Saknad HS-kod/ursprungsland (⚠️) | extraktion | 0 |
| HS-kod ej i TARIC (🔴) | TARIC-uppslag | 0 |
| NAR-tullsats (🔍) | TARIC-uppslag | 0 |
| Låg konfidens i självkontrollen (🟡) | extractor pass 2 | 0 |
| **Beskrivningsmatchning** — ny | AI-verifiering | **1 anrop/faktura** |

### Ny signal: AI-verifierad beskrivningsmatchning

Fakturan säger "Elektronikkort", TARIC säger "Printed circuits" — bara AI kan
avgöra om de betyder samma sak. **Ett** Gemini-anrop per faktura skickar ALLA
varurader (fakturabeskrivning + TARIC-beskrivning) och får per rad tillbaka:
`matchar: "ja"/"nej"/"osäker"` + kort motivering på svenska.

Totalt: 3 anrop/faktura (2 extraktion + 1 verifiering) ≈ 6 fakturor/dag på
gratiskvoten.

## Domregler

- **röd** om något av: beskrivningsmatchning "nej" · HS-kod saknas i TARIC ·
  räknefel på raden · saknad HS-kod/ursprungsland
- **gul** annars om något av: låg konfidens från självkontrollen ·
  beskrivningsmatchning "osäker" · NAR-tullsats · AI-verifieringen kunde inte
  köras (kvot slut/serverfel)
- **grön** annars

## Graciös degradering (viktigt för gratiskvoten)

Om verifieringsanropet misslyckas (429 kvot, 503 server) får berörda varor
domen **gul** med noteringen att AI-verifieringen inte kunde köras — pipelinen
kraschar ALDRIG på grund av kvotfel i detta steg.

## Filändringar

- **`models.py`**: nya Pydantic-modeller `HSMatchBedomning` (item_index,
  matchar, motivering) och `HSMatchResultat` (lista av bedömningar) —
  AI:ns svarsmall för verifieringsanropet.
- **`verifier.py`** (NY): `verify_hs_matches(rader) -> dict | None`.
  Bygger prompten, gör EN strukturerad Gemini-förfrågan, returnerar
  `{item_index: (matchar, motivering)}` eller `None` vid fel. LLM:en skapas
  INUTI funktionen (inte vid import) så tester kan importera modulen utan
  API-nyckel.
- **`customs_logic.py`**: samlar signaler per vara under befintliga loopen,
  anropar `verify_hs_matches` en gång för alla verifierbara rader (de med
  hittad TARIC-beskrivning), räknar ut domen per vara enligt reglerna ovan.
  Nya fält på varje vara: `verdict` ("grön"/"gul"/"röd") och
  `verdict_reasons` (lista korta strängar). Nytt fält på fakturan:
  `verdict_summary` ({"grön": n, "gul": n, "röd": n}). Matchning "nej" ger
  också en 🔴-flagga med AI:ns motivering; "osäker" ger 🟡-flagga.
- **`utils.py`**: varje vara i PDF-rapporten inleds med domsymbol
  (🟢/🟡/🔴) + domskälen; ny sammanfattningsrad "Slutdom: X gröna, Y gula,
  Z röda" ovanför varulistan.
- **`tests/`**: `taric_data_patchad`-fixturen patchar även
  `customs_logic.verify_hs_matches` (svarar "ja" på allt som standard);
  nya tester överstyr med "nej"/"osäker"/None och verifierar domreglerna.

## Testfall

| Scenario | Förväntad dom |
|----------|---------------|
| Allt stämmer + AI säger "ja" | grön |
| AI säger "nej" | röd + 🔴-flagga med motivering |
| AI säger "osäker" | gul |
| AI-verifiering misslyckas (None) | gul + notering |
| Räknefel på raden | röd |
| Låg konfidens från självkontroll | gul |
| Saknad HS-kod | röd |
| HS-kod ej i TARIC | röd |
| verdict_summary | räknar rätt över flera varor |

Alla tester kvotfria (verify_hs_matches monkeypatchas).

## Avgränsningar

- Rapportens fulla makeover (åtgärdsförslag, struktur) är nästa spår —
  här läggs bara domen till i befintlig rapport.
- Ingen cachning av verifieringssvar ännu.
