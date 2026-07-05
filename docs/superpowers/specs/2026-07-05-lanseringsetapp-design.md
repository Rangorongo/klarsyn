# Design: Lanseringsetappen — från prototyp till lanserbar tjänst

**Datum:** 2026-07-05
**Status:** Godkänd av Romeo (samtliga tio punkter valda)

## Mål

Systemet ska tryggt kunna ta emot en betalande kunds fakturor:
inga kvotstopp mitt i uppdrag, skannade PDF:er fungerar, GDPR-maskeringen
håller, protokollet är myndighetsklart med spårbarhet och SEK-belopp,
fraktdubbletter hittas över tid, och det finns intagsvägar (API + e-post)
för kunder.

## Spår A — Blockerare

### A1. Kostnads- och anropslogg (core/llm_klient.py)

- Modulnivå-räknare: varje lyckat/misslyckat anrop loggas med modell och
  tidsstämpel. `hamta_anropslogg()` / `nollstall_anropslogg()`.
- main.py nollställer per körning; antal anrop + använda modeller går in i
  granskningsmetadatan (spår B1) och skrivs i konsolen efter körning.
- Betald nyckel är bara `.env`-byte (redan så) — dokumenteras i README.

### A2. OCR för skannade PDF:er (core/ocr.py + main.py)

- `pypdfium2` (pip, ingen extern binär) renderar sidor till bilder;
  `pytesseract` läser dem. Kräver Tesseract-binären installerad
  (winget UB-Mannheim.TesseractOCR) med svenska+engelska språkdata.
- `load_pdf_text`: om pdfplumber ger tom text → försök OCR om Tesseract
  finns → annars dagens tydliga fel + installationsanvisning.
- Text från OCR markeras i resultatet (`ocr_anvand: true`) och i
  protokollets metadata — OCR-läst text är mer felbenägen och ska ge
  extra försiktighet i konfidensbedömningen (alla varor/sändningar får
  minst gul markering "OCR-läst underlag").
- Tester: fallbacklogiken mockas; äkta OCR-test skippas om binär saknas.

### A3. Utökad PII-maskering (core/pii.py)

Nya mönster utöver e-post, med tester som bevisar att HS-koder, belopp,
datum och tracking-nummer INTE maskeras:

- Svenska personnummer: ÅÅMMDD-XXXX och ÅÅÅÅMMDD-XXXX → [MASKED_PNR]
- Organisationsnummer: XXXXXX-XXXX (giltigt sekelskiftesformat behålls
  oskiljbart från pnr — båda maskas) → [MASKED_ORGNR]
- Telefonnummer: +46-format och 0X(X)-format med vanliga avgränsare
  → [MASKED_PHONE]

## Spår B — Professionalism

### B1. Granskningsmetadata (core/metadata.py + rapporter)

`bygg_granskningsmetadata()` samlar: tidsstämpel, systemversion
(VERSION-konstant), TARIC-filernas ålder (dagar, äldsta fil),
AI-anrop per modell (från A1), OCR använd eller ej.
`save_revision_protocol(..., metadata=...)` får en sektion
"Granskningsmetod och spårbarhet".

### B2. TARIC-färskhetsvarning (modules/customs/taric.py)

`kontrollera_taric_alder(max_dagar=35)` → varningssträng eller None,
baserat på filernas ändringsdatum. Skrivs i konsolen vid laddning och
tas med i metadatan/protokollet. Testas med tmp-filer.

### B3. Valutakonvertering till SEK (core/valuta.py)

- `hamta_sek_kurs(valuta)` — ECB:s dagliga referenskurser
  (eurofxref-daily.xml). EUR→SEK direkt; övriga valutor via EUR-kors.
- Cache i `valutakurser.json` (gitignoras): vid nätverksfel används
  senaste cachen med varning; utan cache hoppas konverteringen över
  med tydlig notering i protokollet.
- Protokollets sammanfattning visar beloppen även i SEK med kursdatum.
- Tester: mockad hämtning, cachefall, korsberäkning.

## Spår C — Kundregister och dubbletthistorik (core/historik.py)

- SQLite (stdlib) i `tullsyn.db` (gitignoras). Tabell `frakthistorik`:
  kund, tracking_number, faktura, datum, belopp, registrerad.
- CLI-flagga `--kund <namn>` (default "standard").
- Fraktflödet: FÖRE registrering kontrolleras varje tracking-nummer mot
  historiken → träff ger 🔴-flagga "tidigare debiterad på faktura X",
  finding DUBBELDEBITERING och besparing. Därefter registreras fakturans
  nummer i historiken.
- Tester med temporär databas: första körningen rent, andra körningen
  med samma tracking flaggar, olika kunder krockar inte.

## Spår D — Större eval

- 3 nya tullfakturor: antidumpningsvara (7326.90.98 CN), villkorstull,
  blandad flervarufaktura; facit utökas.
- Fraktfakturan (frakt_01) får facit och kor_eval lär sig frakt
  (kör run_freight_pipeline via granska_dokument, kontroller på
  fraktflaggor). Kvotkostnad för full eval stiger till ~26 anrop —
  dokumenteras; enstaka fakturor kan köras separat som förut.

## Spår E — FastAPI-backend v1 (api.py)

- Lokal API-server: `uvicorn api:app`. Endpoints:
  - `GET /halsa` — status + version
  - `POST /granska` — multipart-PDF + valfri modul/kund; kör synkront,
    returnerar JSON (findings, verdicts, belopp) + sparar rapporterna
- Nya beroenden: fastapi, uvicorn, python-multipart.
- Tester med FastAPI TestClient och mockad granska_dokument — kvotfritt.
- Autentisering, kö och molndrift är nästa steg (utanför etappen);
  v1 är avsedd för lokal drift och som grund för portalen.

## Spår F — E-postintag v1 (epost_intag.py)

- Poller: läser olästa mejl via IMAP (host/user/lösenord i .env:
  IMAP_HOST, IMAP_USER, IMAP_PASSWORD, SMTP_HOST, SMTP_PORT),
  sparar PDF-bilagor till `inkorg/<avsändare>/`, kör batchen,
  mejlar tillbaka revisionsprotokollet via SMTP.
- Avsändarens adress blir kund-id i historiken (spår C).
- Tester: IMAP/SMTP mockas; flödeslogiken (bilaga → körning → svar)
  verifieras kvotfritt.
- Skarp drift kräver att Romeo skapar/anger ett e-postkonto — koden
  levereras körklar med konfiguration i .env.

## Ordning och verifiering

A1 → A3 → B1+B2 → B3 → C → A2 (OCR, kräver ev. binärinstallation) →
D → E → F. Tester och commit+push per spår; CI ska vara grön.

## Avgränsningar

- Molndrift/hosting av API:t, autentisering, webbportal-frontend: nästa etapp.
- Juridik (avtal, fullmakt, tullombud) ligger utanför koden.
