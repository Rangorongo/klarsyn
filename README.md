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
python main.py                    # granskar sample_invoice.pdf (test)
python main.py min_faktura.pdf    # granskar en specifik faktura
python main.py fakturamapp/       # granskar ALLA PDF:er i mappen
```

Rapporterna (`audit_<fakturanamn>.csv` och `.pdf`) sparas bredvid
respektive faktura. Vid batchkörning fortsätter pipelinen med nästa
faktura även om en misslyckas.

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

## Eval — mät träffsäkerheten

`eval/` innehåller 5 testfakturor med kända planterade fel och ett facit.

```
python eval/generera_testfakturor.py   # skapa om fakturorna (kvotfritt)
python eval/kor_eval.py                # kör hela setet (15 API-anrop!)
python eval/kor_eval.py eval_02_felklassificerad.pdf   # kör en enstaka
```

Resultatet skrivs till konsolen och `eval/resultat.md`.
