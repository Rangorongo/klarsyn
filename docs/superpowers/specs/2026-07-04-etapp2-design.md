# Design: Etapp 2 — korrekthet, kvotrobusthet, antidumpning, batchpolish

**Datum:** 2026-07-04
**Status:** Godkänd av Romeo (alla fyra paketen valda)

## Spår 1: Korrekthetspaketet (taric.py + customs_logic.py)

### 1a. Datumfiltrering av tullsatser

TARIC-datan innehåller 21 407 rader med slutdatum och 6 536 varukoder med
flera MFN-rader — dagens `iloc[0]` kan välja en utgången sats.

- Ny hjälpfunktion i taric.py: `_giltiga_rader(df)` — behåller rader där
  `Start date <= idag` och (`End date` saknas eller `>= idag`).
- Datumformat i filerna: `DD-MM-ÅÅÅÅ` → `pd.to_datetime(..., format="%d-%m-%Y")`.
- Tillämpas på duties-raderna i `lookup_duty` (MFN, preferens) och
  antidumpningsuppslaget innan val av rad.
- Rader med oparsbara datum behålls (hellre en extra rad än en missad).

### 1b. Villkorstullar (Cond:) flaggas

33 703 rader har `Duty = "Cond: ..."` — idag ser varan tullfri ut.

- `lookup_duty`: om vald MFN-duty innehåller `"Cond"` →
  `mfn_duty = "Kräver manuell kontroll (villkorstull)"`.
- customs_logic: 🔍-flaggan och gula skäl utlöses av `"manuell kontroll"`
  i mfn_duty (fångar både NAR och villkorstull) istället för bara `"NAR"`.

### 1c. TARIC-cache

`load_taric_data()` läser 8 MB Excel (~30 s) per faktura i batch.

- Modulnivå-cache i taric.py: första anropet läser filerna, efterföljande
  returnerar samma dict. Batch med 10 fakturor laddar en (1) gång.
- Testernas monkeypatch av `customs_logic.load_taric_data` påverkas inte.

## Spår 2: Kvotrobusthet — modellrotation (ny modul llm_klient.py)

Idag dödar ett 429 (kvot slut) hela extraktionen; bara 503 har retry.
Varje Gemini-gratismodell har egen dagskvot — rotation flerdubblar kapaciteten.

- Ny modul `llm_klient.py`:
  - `MODELLER = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"]`
  - `anropa_strukturerat(prompt, schema)`: provar modellerna i tur och
    ordning; 429/RESOURCE_EXHAUSTED → nästa modell; 503 → vänta 30 s,
    försök igen, sedan nästa modell; annat fel → propagera.
  - LLM skapas INUTI anropet (`_skapa_llm(modell)` — monkeypatchbar i test,
    och ingen API-nyckel krävs vid import → CI fungerar).
- `extractor.py` och `verifier.py` byter till `anropa_strukturerat` och
  slutar skapa LLM på modulnivå.
- Tester: fejk-LLM:er via monkeypatch av `_skapa_llm` — verifierar rotation
  vid 429, retry vid 503, och tydligt fel när alla modeller är slut.

## Spår 3: Antidumpningstullar (taric.py + customs_logic.py + utils.py)

22 348 rader är antidumpningsåtgärder (measure 551–554) — oanvända idag.
ADD kan vara 30–70 % extra tull; missad ADD = risk för böter.

- taric.py: `lookup_antidumping(hs_code, country_code, taric_data) -> str | None`
  — datumgiltiga rader med measure 551–554, matchade på land (kod + namn,
  samma logik som preferens). Returnerar Duty-texten eller None.
- customs_logic: träff → flagga `"🚨 Antidumpningstull kan gälla för X från Y: <duty>
  — kontrollera att den deklarerats"`, gult skäl + åtgärd med hög prioritet.
- utils.py: 🚨 → `[ANTIDUMPNING]` i PDF-taggmappningen.

## Spår 4: Batchpolish

### 4a. Tydligt fel för skannade PDF:er (main.py)

`load_pdf_text` som ger tom text → `ValueError` med svensk förklaring
("PDF:en verkar vara inskannad — ingen läsbar text"). Full OCR läggs i backlog
(kräver att användaren installerar Tesseract).

### 4b. Batch-översiktsrapport (utils.py + main.py)

Vid mappkörning med >1 faktura skrivs `batch_sammanfattning.pdf` i mappen:
tabell med fakturanummer, leverantör, domfördelning, möjlig återbetalning
per faktura + totalsumma + lista över misslyckade filer.

### 4c. GitHub Actions CI (.github/workflows/tests.yml)

- Kör `pytest` på varje push, `windows-latest` (har Arial-fonterna →
  PDF-testerna körs; TARIC-integrationstestet skippas då datan saknas).
- Kräver att inga moduler skapar LLM vid import (löses av spår 2).

## Ordning och verifiering

Spår 1 → 2 → 3 → 4, commit + push per spår. Alla nya funktioner får
kvotfria tester. Klart-kriterium: `pytest` grönt, CI grönt på GitHub.

## Backlog (medvetet utanför etapp 2)

OCR (Tesseract), parquet-cache av TARIC, valutakonvertering till SEK,
momskontroll, utökad PII-maskering, importdeklarationer, Streamlit-demo.
