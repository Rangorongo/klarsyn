# Tullsyn

Modulärt revisionssystem för importföretag. Granskar **tullfakturor** mot
EU:s officiella TARIC-data (felklassificeringar, outnyttjade frihandelsavtal,
antidumpningsrisk, momskonsekvens) och **fraktfakturor** mot avtalslösa
kontroller (dubbeldebitering, volymvikt, summafel, orimliga tillägg).
Varje körning ger beslutsrapporter per faktura och ett formellt
**revisionsprotokoll** — komplett underlag för ändringsansökan hos
Tullverket eller krav mot transportören.

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
python main.py                          # granskar sample_invoice.pdf (test)
python main.py min_faktura.pdf          # dokumenttyp detekteras automatiskt
python main.py fakturamapp/             # granskar ALLA PDF:er i mappen
python main.py faktura.pdf --modul frakt  # tvinga tull- eller fraktmodulen
```

Utdata sparas bredvid respektive faktura:

- `audit_<namn>.csv` och `.pdf` — beslutsrapport per faktura
- `revisionsprotokoll_<datum>.pdf` — numrerade fynd med belopp, beräkning
  och referens: underlaget för ändringsansökan/krav
- `batch_sammanfattning.pdf` — översikt vid mappkörning

Vid batchkörning fortsätter pipelinen med nästa faktura även om en
misslyckas, och listar på slutet exakt vilka som behöver köras om.

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
