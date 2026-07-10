# Systemöversikt — vad Tullsyn kan idag och vad som återstår

*Nulägesbild per 2026-07-11 (commit `a91e389`). För berättelsen bakom,
se [projekthistorik.md](projekthistorik.md).*

## Vad systemet gör, i en mening

Tullsyn läser fakturor (PDF), granskar dem automatiskt mot referensdata —
EU:s tulltaxa TARIC för tull, avtalslösa regler för frakt — och levererar
ett revisionsprotokoll med numrerade fynd som kunden kan använda för
ändringsansökan hos Tullverket eller krav mot transportören.

## Så kör man

```
python main.py faktura.pdf                 # dokumenttyp detekteras automatiskt
python main.py kundmapp/ --kund bolaget    # hel mapp, med kundhistorik
python main.py fil.pdf --modul frakt       # tvinga modul vid behov
pytest                                     # 121 tester, inga API-anrop
python eval/kor_eval.py                    # träffsäkerhetsmätning (kvot!)
```

Kvotkostnad: tullfaktura = 3 Gemini-anrop, fraktfaktura = 2.
Krav: `.env` med `GOOGLE_API_KEY`, TARIC-Excel i `taric_data/`
(CIRCABC, månadsuppdateras), Windows med Arial-fonter för PDF-rapporter.

## Funktioner per modul

### Kärnan (`core/`)

| Del | Funktion |
|-----|----------|
| `llm_klient` | Alla AI-anrop. Automatisk modellrotation vid kvotstopp (429), retry vid serverfel (503), anropslogg för kostnadskoll |
| `extraktion` | Generell tvåpass-läsning: AI extraherar → samma AI självgranskar kritiskt och sätter konfidens per rad |
| `dokumenttyp` | Avgör tull/frakt via nyckelordspoäng — deterministiskt, gissar aldrig (ber om `--modul` vid tvekan) |
| `pii` | GDPR-maskering före varje AI-anrop: e-post, personnummer, orgnummer, telefon. Maskar ALDRIG HS-koder/belopp/tracking |
| `ocr` | Inskannade PDF:er läses lokalt med Tesseract; OCR-underlag ger automatiskt försiktigare domar (grönt → gult) |
| `historik` | SQLite-kundregister: fraktdubbletter upptäcks ÖVER TID, mellan fakturor |
| `valuta` | SEK-omräkning via ECB-kurser med cache-fallback |
| `metadata` | Spårbarhet per körning: tid, systemversion, AI-anrop, TARIC-ålder, OCR-status |
| `rapporter` | Beslutsrapport (PDF), batchsammanfattning, revisionsprotokoll |

### Tullmodulen (`modules/customs/`)

- TARIC-uppslag med **datumgiltiga** tullsatser (utgångna/framtida rader
  filtreras bort), HS-normalisering, EU-varor direkt tullfria
- MFN- och preferenstullsatser (frihandelsavtal, matchning på både
  landskod och landsnamn), NAR- och villkorstullar → manuell kontroll
- **Antidumpningstullar** (measure 551–554) — flaggar bötesrisk
- AI-dubbelkontroll: matchar varubeskrivningen TARIC-beskrivningen?
- Aritmetikkontroller (rad och fakturatotal), möjlig återbetalning som
  ärlig övre gräns, **momskonsekvens** (25 %, avdragsgill-notering)

### Fraktmodulen (`modules/freight/`)

- Dubbeldebitering inom fakturan OCH mot kundens historik
- Volymviktskontroll: debiterad vikt mot max(verklig, L×B×H/divisor),
  divisor per transportör
- Summakontroller (grundfrakt + tillägg = total; sändningar = fakturatotal)
- Orimliga procenttillägg (>35 % bränsle) → manuell kontroll
- Saknade tracking-nummer och låg AI-konfidens → gula domar

### Utdata per körning

1. `audit_<faktura>.csv` + `.pdf` — beslutsrapport per faktura: domar
   (grön/gul/röd), åtgärdslista sorterad efter prioritet, detaljer
2. `batch_sammanfattning.pdf` — översikt vid mappkörning
3. `revisionsprotokoll_<datum>.pdf` — numrerade fynd med feltyp, belopp,
   beräkning, referens, åtgärd + spårbarhetssektion + SEK-summa

## Kvalitetsläget

- **121 automatiska tester**, körs utan nätverk/API-nyckel/TARIC-data;
  GitHub Actions kör allt vid varje push (grön)
- **Eval 16/16 (100 %)** på testfakturor med planterade fel; skarp
  fraktkörning hittade 4/4 planterade fel
- Verifierat end-to-end mot riktiga Gemini + riktig TARIC-data
- **INTE verifierat mot riktiga kundfakturor** — se risker.md, risk A1

## Vad som återstår — och varför det väntar

### Före första kunduppdraget (ingen kod)

| Åtgärd | Status |
|--------|--------|
| Pilotkund med riktiga fakturor | **Viktigast av allt** — enda sättet att bevisa extraktionen |
| Betald Gemini-nyckel | Byts i `.env` när uppdrag finns |
| Tesseract-installation | `winget install -e --id UB-Mannheim.TesseractOCR` (kräver admin-klick) |
| Uppdragsavtal + tullombud | Juridik — se risker.md |

### Fryst tills värdeloopen är bevisad (medvetet beslut)

- **Kundhemsida/portal** — marknadssidan finns byggd i separata repot
  `tullsyn-web` (premium-design, animerad demo) men publiceringen
  parkerades; kundportal med uppladdning kräver backend
- **E-postintag** — kunden mejlar fakturor, systemet svarar med protokoll;
  designad i lanseringsspecen, ej byggd
- **FastAPI-backend** — krävs för portal/skala; kräver också att
  PDF-rapporternas Windows-fontberoende löses (Linux-drift)
- **Frakt V2** — transportörsindex, kundavtal, GSR (kräver extern data)
- **Större eval** (20+ fakturor) — statistiskt hållbar träffsiffra
- Full momsavstämning, importdeklarationsparsning, OCR-kvalitetsmätning

Beslutslogik: skalinfrastruktur byggs när det finns kunder att skala för —
inte före. Se `docs/superpowers/specs/2026-07-05-lanseringsetapp-design.md`.
