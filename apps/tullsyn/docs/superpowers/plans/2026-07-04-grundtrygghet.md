# Grundtrygghet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ge Tullsyn ett säkert git-fundament (.gitignore, requirements.txt, README) och en kvotfri testsvit med syntetiska TARIC-DataFrames som fångar regressioner i taric.py och customs_logic.py.

**Architecture:** Syntetiska mini-DataFrames med exakt samma kolumnnamn som de riktiga TARIC-Excel-filerna matas direkt in i `lookup_duty` och `verify_hs_description` — ingen fil-I/O i testerna. `customs_logic`-tester monkeypatchar `load_taric_data` så de riktiga filerna aldrig behövs. Ett separat integrationstest skippas automatiskt om `taric_data/` saknas.

**Tech Stack:** Python 3.13, pytest, pandas, befintliga moduler taric.py och customs_logic.py

## Global Constraints

- Alla kommentarer, docstrings och testnamn på svenska — konsekvent med resten av projektet
- Inga Gemini-anrop i någon test — hela testsviten är kvotfri
- `pytest` körs från projektroten (`C:\Users\Romeo\Desktop\tullsyn\`)
- Inga nya externa beroenden utöver `pytest` (redan i requirements.txt)
- Förändra INTE `taric.py` eller `customs_logic.py` — testerna ska verifiera nuvarande beteende

---

### Task 1: Versionshantering — .gitignore, requirements.txt, README + källkods-commit

**Files:**
- Create: `.gitignore`
- Create: `requirements.txt`
- Create: `README.md`

**Interfaces:**
- Produces: `.gitignore` som utesluter `.env`, `__pycache__/`, `audit_*.csv`, `audit_*.pdf`, `taric_data/`

- [ ] **Steg 1: Skapa .gitignore**

Skapa filen `.gitignore` i projektroten med exakt detta innehåll:

```
# Hemliga nycklar — får ALDRIG versionshanteras
.env

# Pythons kompileringscache
__pycache__/
*.pyc

# Genererade rapport-filer från pipelinen
audit_*.csv
audit_*.pdf

# TARIC Excel-filer (~8 MB+) — laddas ner manuellt från CIRCABC, uppdateras månadsvis
taric_data/
```

- [ ] **Steg 2: Verifiera att .gitignore fungerar**

Kör:
```
git status --short
```

Förväntat: `.env`, `__pycache__/`, `audit_sample_invoice.pdf.csv`, `audit_sample_invoice.pdf.pdf` och `taric_data/` SKA INTE synas i listan. Om de syns har .gitignore inte sparats rätt — kontrollera filnamnet (inget .txt-suffix).

De filer som SKA synas (som `??`) är: `README.md`, `requirements.txt`, `.gitignore`, `check_models.py`, `customs_logic.py`, `extractor.py`, `main.py`, `models.py`, `sample_invoice.pdf`, `taric.py`, `utils.py`.

- [ ] **Steg 3: Skapa requirements.txt**

Skapa filen `requirements.txt` i projektroten:

```
langchain-google-genai
langgraph
pdfplumber
pandas
openpyxl
reportlab
python-dotenv
pytest
```

- [ ] **Steg 4: Skapa README.md**

Skapa filen `README.md` i projektroten:

```markdown
# Tullsyn

Automatiserar granskning av tullfakturor mot EU:s officiella TARIC-data.
Hittar felaktiga HS-koder, outnyttjade frihandelsavtal och beräknar potentiella
tullar som kan återkrävas.

## Installation

```
pip install -r requirements.txt
```

## Konfiguration

Skapa en `.env`-fil i projektets rotmapp:

```
GOOGLE_API_KEY=din_nyckel_här
```

Hämta din API-nyckel gratis på: https://aistudio.google.com/

## Kör pipelinen

```
python main.py
```

Resultatet sparas som `audit_sample_invoice.pdf.csv` och
`audit_sample_invoice.pdf.pdf` i projektroten.

För att analysera en annan faktura: öppna `main.py` och ändra filnamnet
i `run_pipeline()`-anropet längst ner i filen.

## TARIC-data

Pipelinen kräver fyra Excel-filer i en `taric_data/`-mapp i projektroten:

- `Duties Import 01-99.xlsx`
- `Geographical areas description.xlsx`
- `Geographical areas composition.xlsx`
- `Nomenclature EN.xlsx`

Ladda ner dem från EU:s CIRCABC-portal (sök på "TARIC and Quota").
Filerna uppdateras månadsvis — ladda ner en ny version varje månad.

## Tester

```
pytest
```

Testerna kör utan nätverk och utan `taric_data/`-mappen.
```

- [ ] **Steg 5: Committa all källkod och dokumentation**

```
git add .gitignore requirements.txt README.md check_models.py customs_logic.py extractor.py main.py models.py sample_invoice.pdf taric.py utils.py docs/
git commit -m "Lägg till versionshantering: .gitignore, requirements.txt, README"
```

Kör sedan `git log --oneline` och verifiera att du ser 3 commits.

---

### Task 2: Testfixtures och test_taric.py

**Files:**
- Create: `tests/conftest.py`
- Create: `tests/test_taric.py`

**Interfaces:**
- Produces: fixture `taric_data_syntetisk` (dict med 'duties'- och 'nomenclature'-DataFrames)
- Produces: fixture `taric_data_patchad` (monkeypatchar `customs_logic.load_taric_data`, används i Task 3)
- Consumes: `taric.lookup_duty(hs_code: str, country_code: str, taric_data: dict) -> dict`
- Consumes: `taric.verify_hs_description(hs_code: str, item_description: str, taric_data: dict) -> dict`

- [ ] **Steg 1: Skapa tests/-mapp och conftest.py**

Skapa filen `tests/conftest.py`:

```python
"""
conftest.py

Delade testfixtures för hela testsviten.

En "fixture" är en färdigbyggd testmiljö som pytest ställer i ordning
åt varje test — ungefär som att duka bordet innan middagen.

taric_data_syntetisk: En miniatyrversion av TARIC-datan med exakt
    samma kolumnnamn som de riktiga Excel-filerna, men bara ett fåtal
    handplockade rader som täcker alla testfall.

taric_data_patchad: Byter ut load_taric_data() i customs_logic mot
    den syntetiska datan — så inga riktiga filer behövs.
"""

import pandas as pd
import pytest


@pytest.fixture
def taric_data_syntetisk():
    """
    Bygger syntetiska TARIC-DataFrames med exakt de kolumnnamn koden förväntar sig.

    Tre rader i duties-tabellen täcker alla testfall:
        - 8534000000: MFN-tull 3.3% (ERGA OMNES) + preferenstull 0% för Japan
        - 8542319000: MFN-tull är NAR (specifik sats, ej procent)
    """
    duties = pd.DataFrame({
        "Goods code":     ["8534000000", "8534000000", "8542319000"],
        "Origin":         ["ERGA OMNES", "Japan",      "ERGA OMNES"],
        "Origin code":    ["1011",       "JP",         "1011"],
        "Meas. type code":["103",        "142",        "103"],
        "Duty":           ["3.300 %",    "0.000 %",    "NAR"],
    })

    nomenclature = pd.DataFrame({
        # OBS: Goods code i nomenklaturen har suffix (t.ex. " 80") — koden matchar på [:10]
        "Goods code":  ["8534000000 80",  "8542319000 80"],
        "Description": ["Printed circuits", "Integrated circuits"],
    })

    return {
        "duties":       duties,
        "nomenclature": nomenclature,
        "geo_areas":    pd.DataFrame(),
        "geo_comp":     pd.DataFrame(),
    }


@pytest.fixture
def taric_data_patchad(monkeypatch, taric_data_syntetisk):
    """
    Ersätter load_taric_data() i customs_logic med den syntetiska datan.
    Används av test_customs_logic.py för att slippa riktiga Excel-filer.
    """
    monkeypatch.setattr(
        "customs_logic.load_taric_data",
        lambda: taric_data_syntetisk
    )
```

- [ ] **Steg 2: Verifiera att fixtures importeras utan fel**

Kör:
```
pytest tests/conftest.py --collect-only
```

Förväntat: `no tests ran` (inga testfunktioner i conftest.py) utan felmeddelanden.

- [ ] **Steg 3: Skapa tests/test_taric.py**

Skapa filen `tests/test_taric.py`:

```python
"""
test_taric.py

Testar uppslagslogiken i taric.py med syntetiska TARIC-DataFrames.
Inga riktiga Excel-filer behövs och inga nätverksanrop görs.
"""

import os
import pytest
from taric import lookup_duty, verify_hs_description


def test_hs_normalisering_tar_bort_punkter_och_fyller_till_10(taric_data_syntetisk):
    """Punktnotation (8534.00.00) ska matcha TARIC-koden 8534000000."""
    resultat = lookup_duty("8534.00.00", "CN", taric_data_syntetisk)
    # CN har inget FTA men koden finns i TARIC — MFN-tullen ska hittas
    assert resultat["mfn_duty"] == "3.300 %"


def test_eu_land_ger_noll_procent_utan_uppslag(taric_data_syntetisk):
    """EU-länder ska returnera 0% direkt, utan att TARIC-tabellen slås upp."""
    for landskod in ["DE", "PL", "SE", "FR", "IT"]:
        resultat = lookup_duty("8534.00.00", landskod, taric_data_syntetisk)
        assert resultat["mfn_duty"] == "0%", f"Fel för {landskod}"
        assert resultat["has_fta"] is True, f"has_fta ska vara True för {landskod}"


def test_mfn_uppslag_via_erga_omnes(taric_data_syntetisk):
    """MFN-tullen hittas via raden med Origin='ERGA OMNES' och measure type 103."""
    resultat = lookup_duty("8534000000", "CN", taric_data_syntetisk)
    assert resultat["mfn_duty"] == "3.300 %"
    assert resultat["has_fta"] is False  # CN har inget frihandelsavtal i testdatan


def test_preferenstull_japan_hittas_via_landsnamn(taric_data_syntetisk):
    """
    Japan-matchning sker via COUNTRY_NAME_MAP: landskod 'JP' → landsnamn 'Japan'.
    Raden i duties har Origin='Japan', inte 'JP' — koden måste klara båda.
    """
    resultat = lookup_duty("8534.00.00", "JP", taric_data_syntetisk)
    assert resultat["has_fta"] is True
    assert resultat["preferential_duty"] == "0.000 %"
    assert resultat["mfn_duty"] == "3.300 %"  # MFN ska fortfarande returneras


def test_nar_ger_manuell_kontroll_text(taric_data_syntetisk):
    """NAR i Duty-kolumnen betyder specifik tullsats — ska inte tolkas som procent."""
    resultat = lookup_duty("8542.31.90", "CN", taric_data_syntetisk)
    assert "NAR" in resultat["mfn_duty"]
    assert "manuell kontroll" in resultat["mfn_duty"].lower()


def test_saknad_hs_kod_ger_troligen_tullfri(taric_data_syntetisk):
    """HS-kod utan rad i TARIC ska returnera 'troligen tullfri', inte krascha."""
    resultat = lookup_duty("9999999999", "CN", taric_data_syntetisk)
    assert "troligen tullfri" in resultat["mfn_duty"].lower()
    assert resultat["has_fta"] is False


def test_verify_hs_description_hittar_beskrivning_trots_suffix(taric_data_syntetisk):
    """
    Goods code i nomenklaturen har suffix (t.ex. '8534000000 80').
    Matchningen ska ske på de första 10 tecknen — suffix ignoreras.
    """
    resultat = verify_hs_description("8534.00.00", "Elektronikkort", taric_data_syntetisk)
    assert resultat["taric_description"] == "Printed circuits"


def test_verify_hs_description_okand_kod_ger_ej_hittad(taric_data_syntetisk):
    """Okänd HS-kod ska returnera 'Ej hittad', inte krascha."""
    resultat = verify_hs_description("9999999999", "Okänd vara", taric_data_syntetisk)
    assert resultat["taric_description"] == "Ej hittad"


# --- Integrationstest (kör bara om taric_data/ finns) ---

TARIC_MAPP = os.path.join(os.path.dirname(__file__), "..", "taric_data")

@pytest.mark.skipif(
    not os.path.isdir(TARIC_MAPP),
    reason="taric_data/ saknas — hoppar över integrationstest"
)
def test_riktiga_taric_filer_har_ratt_kolumner():
    """
    Läser de riktiga Excel-filerna och verifierar att förväntade kolumner finns.
    Fångar om EU ändrar filformatet vid en månadsvis uppdatering.
    """
    from taric import load_taric_data
    data = load_taric_data()

    obligatoriska_duties_kolumner = [
        "Goods code", "Origin", "Origin code", "Duty", "Meas. type code"
    ]
    for kolumn in obligatoriska_duties_kolumner:
        assert kolumn in data["duties"].columns, f"duties saknar kolumn: {kolumn}"

    assert "Goods code" in data["nomenclature"].columns
    assert "Description" in data["nomenclature"].columns
```

- [ ] **Steg 4: Kör testerna och verifiera att de går grönt**

Kör:
```
pytest tests/test_taric.py -v
```

Förväntat: 8 PASSED (integrationstestet SKIPPED om taric_data/ saknas), inga FAILED.

Om ett test misslyckas: läs felmeddelandet noga — det pekar på vilken rad och vilket värde som var fel.

- [ ] **Steg 5: Committa**

```
git add tests/
git commit -m "Lägg till testfixtures och enhetstester för taric.py"
```

---

### Task 3: test_customs_logic.py

**Files:**
- Create: `tests/test_customs_logic.py`

**Interfaces:**
- Consumes: fixture `taric_data_patchad` (från conftest.py — monkeypatchar `customs_logic.load_taric_data`)
- Consumes: `customs_logic.run_customs_audit(final_output: dict) -> dict`
  - Returnerar samma dict utökad med: `audit_flags` (lista av strängar), `potential_savings` (float), `currency` (str)

- [ ] **Steg 1: Skapa tests/test_customs_logic.py**

Skapa filen `tests/test_customs_logic.py`:

```python
"""
test_customs_logic.py

Testar flagglogiken och besparingsberäkningarna i customs_logic.py.

Alla tester använder fixtures `taric_data_patchad` som ersätter
load_taric_data() med syntetisk data — inga Excel-filer eller API-anrop behövs.

Syntetisk TARIC-data som testerna utgår ifrån:
    - HS 8534.00.00 från JP: MFN 3.300 %, preferenstull 0.000 % (FTA finns)
    - HS 8534.00.00 från CN: MFN 3.300 %, inget FTA
    - HS 8542.31.90 från CN: MFN NAR (manuell kontroll), beskrivning finns
    - HS 9999999999 från CN: ingen rad i TARIC (troligen tullfri, beskrivning saknas)
"""

import pytest
from customs_logic import run_customs_audit


def _bygg_faktura(items, shipping_cost=0.0, currency="EUR"):
    """Hjälpfunktion: bygger ett minimalt faktura-dict för tester."""
    return {
        "items": items,
        "shipping_cost": shipping_cost,
        "currency": currency,
    }


def _vara(description="Testvara", hs_code="8534.00.00", country="CN",
          total_price=100.0):
    """Hjälpfunktion: bygger ett minimalt varurad-dict för tester."""
    return {
        "description": description,
        "hs_code": hs_code,
        "country_of_origin": country,
        "quantity": 1,
        "unit_price": total_price,
        "total_item_price": total_price,
    }


def test_saknad_hs_kod_ger_varning(taric_data_patchad):
    """Vara utan HS-kod ska flaggas med ⚠️ och inte krascha."""
    faktura = _bygg_faktura([_vara(hs_code=None)])
    resultat = run_customs_audit(faktura)
    assert any("⚠️" in f and "HS-kod" in f for f in resultat["audit_flags"])


def test_saknat_ursprungsland_ger_varning(taric_data_patchad):
    """Vara utan ursprungsland ska flaggas med ⚠️ och inte krascha."""
    faktura = _bygg_faktura([_vara(country=None)])
    resultat = run_customs_audit(faktura)
    assert any("⚠️" in f and "ursprungsland" in f for f in resultat["audit_flags"])


def test_hs_kod_ej_i_taric_ger_rod_flagga(taric_data_patchad):
    """
    Vara med HS-kod som saknar beskrivning i TARIC-nomenklaturen ska ge 🔴.
    9999999999 finns inte i den syntetiska datan.
    """
    faktura = _bygg_faktura([_vara(hs_code="9999999999", country="CN")])
    resultat = run_customs_audit(faktura)
    assert any("🔴" in f for f in resultat["audit_flags"])


def test_fta_mojlighet_ger_pengar_flagga(taric_data_patchad):
    """
    Vara från Japan med 0%-preferenstull ska generera 💰-flagga
    om frihandelsavtalet verkar oanvänt.
    """
    faktura = _bygg_faktura([_vara(country="JP")])
    resultat = run_customs_audit(faktura)
    assert any("💰" in f for f in resultat["audit_flags"])


def test_mfn_tull_plus_fta_ger_euro_flagga_och_ratt_belopp(taric_data_patchad):
    """
    Vara från Japan med MFN 3.300% och FTA ska ge 💶-flagga med korrekt belopp.
    Tullvärde = varupris + frakt: 100 + 50 = 150 EUR.
    Beräknad tull: 150 × 0.033 = 4.95 EUR.
    """
    faktura = _bygg_faktura([_vara(country="JP", total_price=100.0)], shipping_cost=50.0)
    resultat = run_customs_audit(faktura)
    assert any("💶" in f for f in resultat["audit_flags"])
    assert resultat["potential_savings"] == pytest.approx(4.95)


def test_frakt_delas_jamnt_over_alla_varor(taric_data_patchad):
    """
    Frakten ska delas jämnt över alla varor i tullvärdesberäkningen.
    2 varor, frakt 100 → varje vara får 50 i frakttillägg.
    Vara 1: (100 + 50) × 0.033 = 4.95
    Vara 2: (200 + 50) × 0.033 = 8.25
    Totalt: 13.20 EUR
    """
    varor = [
        _vara(description="Vara 1", country="JP", total_price=100.0),
        _vara(description="Vara 2", country="JP", total_price=200.0),
    ]
    faktura = _bygg_faktura(varor, shipping_cost=100.0)
    resultat = run_customs_audit(faktura)
    assert resultat["potential_savings"] == pytest.approx(13.20)


def test_nar_tull_ger_lupp_flagga(taric_data_patchad):
    """Vara med NAR-tullsats ska flaggas med 🔍 för manuell kontroll."""
    faktura = _bygg_faktura([_vara(hs_code="8542.31.90", country="CN")])
    resultat = run_customs_audit(faktura)
    assert any("🔍" in f for f in resultat["audit_flags"])


def test_potential_savings_summeras_och_avrundas(taric_data_patchad):
    """
    potential_savings ska vara summan av alla 💶-besparingar, avrundad till 2 decimaler.
    Vara A: 10 × 0.033 = 0.33
    Vara B: 20 × 0.033 = 0.66
    Totalt: 0.99
    """
    varor = [
        _vara(description="Vara A", country="JP", total_price=10.0),
        _vara(description="Vara B", country="JP", total_price=20.0),
    ]
    faktura = _bygg_faktura(varor, shipping_cost=0.0)
    resultat = run_customs_audit(faktura)
    assert resultat["potential_savings"] == pytest.approx(0.99)
    # Verifiera att värdet faktiskt är avrundat till 2 decimaler
    assert resultat["potential_savings"] == round(resultat["potential_savings"], 2)
```

- [ ] **Steg 2: Kör testerna**

Kör:
```
pytest tests/test_customs_logic.py -v
```

Förväntat: 8 PASSED, inga FAILED.

Om ett test misslyckas: läs felets `AssertionError`-rad — den visar vilket värde som faktiskt returnerades kontra vad som förväntades.

- [ ] **Steg 3: Kör hela testsviten**

Kör:
```
pytest -v
```

Förväntat: 16 PASSED (+ SKIPPED för integrationstestet om taric_data/ saknas).

- [ ] **Steg 4: Committa**

```
git add tests/test_customs_logic.py
git commit -m "Lägg till enhetstester för customs_logic.py"
```

---

## Klart-kriterier (verifiera innan du anser dig klar)

1. `git log --oneline` visar 5 commits.
2. `git status` visar att `.env`, `__pycache__/`, `audit_*`-filer och `taric_data/` **inte** visas.
3. `pytest -v` ger 16 PASSED (integrationstestet antingen PASSED eller SKIPPED — aldrig FAILED).
