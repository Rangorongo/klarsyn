# Design: Grundtrygghet — versionshantering och testsvit

**Datum:** 2026-07-03
**Status:** Godkänd av Romeo

## Syfte

Projektet customs_recovery_ai fungerar hela vägen (PDF → extraktion → TARIC-revision
→ rapport) men saknar två grundskydd:

1. **Versionshantering** — utan git kan en felaktig ändring eller diskkrasch radera
   allt arbete, och `.env` med API-nyckeln ligger oskyddad.
2. **Tester** — utan tester finns inget som fångar om en framtida ändring råkar
   förstöra HS-normaliseringen, EU-regeln eller flagglogiken.

Allt arbete i denna design är kvotfritt: inga Gemini-anrop behövs någonstans.

## Del 1: Versionshantering

- `git init` i projektroten (klart — repot skapades när denna spec committades).
- `.gitignore` som utesluter:
  - `.env` — innehåller `GOOGLE_API_KEY`, får ALDRIG committas
  - `__pycache__/` — Pythons kompileringscache
  - `audit_*.csv` och `audit_*.pdf` — genererade utdata från pipelinen
  - `taric_data/` — nedladdningsbar rådata (~8 MB+), uppdateras månadsvis från
    CIRCABC; README beskriver var den hämtas
- `requirements.txt` med projektets beroenden:
  `langchain-google-genai`, `langgraph`, `pdfplumber`, `pandas`, `openpyxl`,
  `reportlab`, `python-dotenv`, `pytest`
- `README.md` (kort, på svenska): vad projektet gör, installation
  (`pip install -r requirements.txt`), konfiguration (`.env` med `GOOGLE_API_KEY`),
  körning (`python main.py`), var TARIC-filerna laddas ner och att de uppdateras
  månadsvis.
- Första commit av all källkod + dokumentation (men inte det som `.gitignore`
  utesluter).

## Del 2: Testsvit

### Vald strategi: syntetiska mini-DataFrames (alternativ A)

Testerna bygger små låtsas-tabeller (5–10 rader) med **exakt samma kolumnnamn**
som de riktiga TARIC-Excel-filerna och matar in dem i `lookup_duty` /
`verify_hs_description`. Fördelar:

- Kör på millisekunder — ingen inläsning av 8 MB Excel per testkörning.
- Fungerar även på en dator utan `taric_data/`-mappen.
- Varje testfall kan konstrueras exakt (Japan-matchning, NAR, saknad kod).

Kompromiss: **ett** integrationstest kör mot de riktiga Excel-filerna, men hoppas
över automatiskt (`pytest.mark.skipif`) om `taric_data/` saknas. Det fångar om EU
ändrar kolumnnamn i filerna.

### Struktur

```
tests/
├── conftest.py        Delade fixtures: syntetiska TARIC-DataFrames
├── test_taric.py      Tester för taric.py
└── test_customs_logic.py  Tester för customs_logic.py
```

Tester skrivs på svenska (namn och docstrings), i linje med resten av projektet.
Körs med `pytest` från projektroten.

### Testfall — taric.py

| Testfall | Förväntat |
|----------|-----------|
| HS-normalisering: `"8534.00.00"` | matchar `"8534000000"` (punkter bort, utfyllnad till 10) |
| EU-land (t.ex. `"DE"`, `"PL"`) | 0 % direkt, inget TARIC-uppslag |
| MFN-uppslag | rad med `Origin == "ERGA OMNES"` och measure type 103/105/106/109 hittas |
| Preferenstull Japan | hittas via BÅDE `Origin code == "JP"` och `Origin == "Japan"` (COUNTRY_NAME_MAP) |
| `Duty == "NAR"` | returnerar "Kräver manuell kontroll (NAR)" |
| HS-kod utan tullrad | "troligen tullfri" + notering om manuell kontroll |
| `verify_hs_description` | hittar beskrivning i Nomenclature (Goods code med suffix, `.str[:10]`) |

### Testfall — customs_logic.py

| Testfall | Förväntat |
|----------|-----------|
| Vara utan HS-kod | ⚠️-flagga, varan hoppas över |
| Vara utan ursprungsland | ⚠️-flagga, varan hoppas över |
| HS-kod ej i TARIC | 🔴-flagga ("kan vara felklassificerad") |
| FTA finns med 0 %-preferens | 💰-flagga |
| MFN-tull + FTA | 💶-flagga med korrekt belopp: (varupris + frakt/antal varor) × MFN-sats |
| Fraktfördelning | frakten delas jämnt över alla varor i beräkningen |
| `Duty == "NAR"` | 🔍-flagga för manuell kontroll |
| `potential_savings` | summeras korrekt över flera varor och avrundas till 2 decimaler |

TARIC-uppslagen i customs_logic-testerna använder samma syntetiska DataFrames
via `monkeypatch`/fixtures — inga riktiga filer och inga API-anrop.

### Integrationstest (valfritt körbart)

- Laddar de riktiga Excel-filerna med `load_taric_data()` och verifierar att
  förväntade kolumner finns (`Goods code`, `Origin`, `Duty`, `Meas. type code` m.fl.).
- Skippas automatiskt om `taric_data/` saknas.

## Avgränsningar (medvetet utanför)

- Inga tester för `extractor.py` (kräver Gemini-anrop) eller `utils.py`:s
  PDF-generering (kräver Windows-fonter) i denna omgång.
- Ingen ändring av besparingslogiken eller confidence-hanteringen — det är
  nästa spår ("Ärligare siffror"), inte detta.
- Ingen CI/GitHub-koppling ännu — bara lokalt git-repo.

## Klart-kriterier

1. `git log` visar minst en commit; `git status` visar att `.env`, `__pycache__/`,
   `audit_*`-filer och `taric_data/` ignoreras.
2. `pip install -r requirements.txt` i en ren miljö räcker för att köra projektet.
3. `pytest` går grönt från projektroten utan nätverk och utan `taric_data/`
   (integrationstestet får skippas).
