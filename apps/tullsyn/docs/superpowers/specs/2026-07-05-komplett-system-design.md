# Design: Komplett revisionssystem — frakt, moms och revisionsprotokoll

**Datum:** 2026-07-05
**Status:** Godkänd av Romeo (V1-frakt · momskonsekvens · autodetektering + flagga · protokoll som komplement)

## Mål

Ett komplett revisionssystem med tre granskningsben som delar samma grund:

1. **Tull** (klar sedan tidigare) — TARIC, konfidensdomar, antidumpning
2. **Frakt** (NY, V1 enligt docs/moduler/fraktmodul-plan.md) — avtalslösa kontroller
3. **Moms** (NY) — momskonsekvensen av varje hittat tullfel

Varje körning producerar, utöver beslutsrapporten, ett **formellt
revisionsprotokoll**: numrerade fynd med feltyp, belopp, beräkning och
referens — komplett underlag för ändringsansökan hos Tullverket eller
krav mot transportör.

## Arkitektur: refaktorering till core/ + modules/

Enligt användarens egen modulplan. Ren flytt utan logikändring, skyddad
av befintliga 66+ tester:

```
core/
├── llm_klient.py      (flytt från roten — modellrotation)
├── extraktion.py      (generaliserad tvåpass-extraktion: tar text, schema
│                       och domänspecifika promptbyggare — tidigare hårdkodad
│                       mot CustomsInvoice i extractor.py)
├── dokumenttyp.py     (NY — se nedan)
├── pii.py             (mask_pii, flytt från utils.py)
└── rapporter.py       (save_to_csv/save_to_pdf/save_batch_summary, flytt,
                        + NYTT save_revision_protocol)
modules/customs/
├── schema.py          (CustomsInvoice, InvoiceItem, HSMatch*, från models.py)
├── taric.py           (flytt)
├── verifier.py        (flytt — AI-beskrivningsmatchning är tullspecifik)
├── prompts.py         (promptbyggarna från extractor.py)
└── rules.py           (customs_logic.run_customs_audit + NYTT moms + findings)
modules/freight/
├── schema.py          (NY: FreightInvoice, Shipment, SurchargeLine)
├── facit.py           (NY: volymviktsdivisorer per transportör, taknivåer)
├── prompts.py         (NY: extraktions- och självkontrollprompter för frakt)
└── rules.py           (NY: run_freight_audit)
main.py                (kvar i roten: CLI, dokumentrouting, orkestrering)
```

`CustomsGraphState`/LangGraph behålls för tullflödet (oförändrat beteende);
fraktflödet anropar extraktionen direkt — samma tvåpassmönster, mindre
ceremoni. Gamla rotfilerna (extractor.py, customs_logic.py, taric.py,
models.py, utils.py, verifier.py, llm_klient.py) ersätts av strukturen ovan
och alla tester uppdateras till nya importvägar.

## Dokumenttypsdetektering (core/dokumenttyp.py)

Deterministisk nyckelordsklassificerare — kvotfri, testbar, förutsägbar:

- Fraktsignaler: tracking/AWB/waybill, volymvikt/volumetric, bränsletillägg/
  fuel surcharge, transportörsnamn (DHL, DSV, Schenker, UPS, FedEx, PostNord...)
- Tullsignaler: HS-kod/HS code, ursprungsland/country of origin, tulltaxa,
  Incoterm, customs
- Flest poäng vinner. Vid oavgjort/för svag signal: tydligt svenskt fel som
  ber användaren ange `--modul tull|frakt`.
- CLI-flaggan `--modul` överstyr alltid detekteringen.

## Fraktmodulen V1 (modules/freight/)

**Schema** (fält som saknas i fakturan = None, AI:n gissar aldrig, format
bevaras exakt — samma principer som tull):

- `FreightInvoice`: invoice_number, invoice_date, carrier_name, currency,
  total_invoice_amount, shipments[]
- `Shipment`: tracking_number, ship_date, origin, destination, service_level,
  actual_weight_kg, billed_weight_kg, length_cm, width_cm, height_cm,
  base_freight, surcharges[], total_charge, confidence, review_note
- `SurchargeLine`: name, amount, percentage

**Facit (facit.py):** `VOLYMVIKTSDIVISOR` per transportör (standard 5000,
konfigurerbar: {"DHL": 5000, "UPS": 5000, ...}), `MAX_PROCENTTILLAGG = 35.0`.

**Regler (rules.py → run_freight_audit):**

| Kontroll | Flagga | Dom | Besparing |
|----------|--------|-----|-----------|
| Samma tracking_number ≥2 ggr i fakturan | 🔴 dubbeldebitering | röd | dubblettens total_charge |
| Sändning utan tracking_number | ⚠️ dubblettkontroll ej möjlig | gul | — |
| billed_weight > max(verklig, volymvikt) + 0,5 kg | 🧮 överdebiterad vikt | röd | — (begär omräkning) |
| base + summa(tillägg) ≠ total_charge (tolerans 0,05) | 🧮 radfel | röd | positiv avvikelse |
| summa(sändningar) ≠ fakturatotal | 🧮 totalfel | — (fakturanivå) | — |
| procenttillägg > 35 % | 🔍 orimligt tillägg | gul | — |
| confidence == "låg" | 🟡 + review_note | gul | — |

Domlogik, verdict_summary, action_items och potential_savings följer exakt
samma mönster som tullmodulen. Historik-dubblettkontroll (mot tidigare
fakturor) kräver databas → backlog, flaggas inte som fel nu.

## Momskonsekvens (modules/customs/rules.py)

För varje 💶-fynd (möjlig tullåterbetalning) beräknas även importmomsen
som betalats på den felaktiga tullen:

- `moms_konsekvens = tullbesparing × 0,25` (svensk standardmoms; satsen
  konstant `MOMSSATS = 0.25` i rules.py)
- Ny flagga 🧾: "Momskonsekvens: ytterligare X kan ha överbetalats i
  importmoms — normalt avdragsgill, påverkar främst likviditet"
- Nytt fält `potential_vat` i resultatet; visas i rapport och protokoll
  med ÄRLIG notering om avdragsrätten (för momsregistrerade företag är
  detta likviditet, inte kostnad).

## Strukturerade fynd (findings)

Både customs- och freight-rules bygger, parallellt med flaggorna, en lista
`findings` — ett strukturerat objekt per fynd:

```python
{"modul": "tull|frakt|moms", "kategori": "FELKLASSIFICERING|PROCENTSATS|
 RÄKNEFEL|SAKNAT FÄLT|ANTIDUMPNING|FTA-MÖJLIGHET|MOMS|DUBBELDEBITERING|
 VIKT|TILLÄGG", "objekt": "varans/sändningens namn", "beskrivning": str,
 "belopp": float|None, "berakning": "formeln med siffror"|None,
 "referens": "TARIC-kod, avtal, tracking-nr..."|None, "atgard": str}
```

Flaggorna (för människor) och findings (för protokollet) skapas på samma
ställen i koden så de aldrig divergerar.

## Revisionsprotokollet (core/rapporter.py → save_revision_protocol)

Formell PDF per körning (enskild faktura eller batch), komplement till
beslutsrapporten:

1. **Titelsida-block**: "Revisionsprotokoll", datum, omfattning (antal
   fakturor per modul), granskningsmetod (TARIC-datum, AI-dubbelkontroll)
2. **Sammanfattning**: möjliga belopp per kategori — tull, moms, frakt —
   och totalt; antal fynd per allvarlighetsgrad
3. **Numrerade fynd** (FYND 1, 2, ...): feltyp, faktura, objekt,
   beskrivning, belopp, beräkning, referens, rekommenderad åtgärd
4. **Bilageförteckning**: respektive fakturas audit-rapport (CSV + PDF)
5. **Friskrivning**: beloppen är övre gränser som ska verifieras mot
   importdeklaration/fraktavtal innan ansökan; protokollet är underlag,
   inte en myndighetsansökan.

Filnamn: `revisionsprotokoll_<datum>.pdf` bredvid fakturorna.

## main.py — orkestrering

- `python main.py <pdf|mapp> [--modul tull|frakt]`
- Per PDF: läs text → maska PII → detektera/tvinga modul → kör modulens
  pipeline → spara audit-rapporter
- Efter körningen: batchsammanfattning (om >1) + revisionsprotokoll (alltid)
- `run_pipeline(path)` behåller namn och beteende (tull) så eval-skripten
  fungerar oförändrat.

## Tester

- Alla befintliga tester uppdateras till nya importvägar och ska förbli gröna.
- Nya kvotfria tester: dokumenttypklassificeraren (frakt/tull/oklart),
  samtliga fraktregler (dubbeldebitering, vikt, summor, tillägg, konfidens,
  domar, savings), momskonsekvensen (belopp + flagga + ärlighetstext),
  findings-strukturen, protokoll-rök (PDF skapas med fynd från båda moduler).
- CI (GitHub Actions) fortsätter köra allt på varje push.
- Testfraktfakturor genereras kvotfritt (reportlab) i eval/fakturor/ för
  framtida eval av fraktextraktionen.

## Avgränsningar

- Freight V2 (transportörsindex, kundavtal, GSR) — kräver extern data, backlog.
- Historikdubbletter (databas), OCR, backend/API — backlog enligt tidigare.
- Full momsavstämning mot deklaration — kräver deklarationsdata, backlog.

## Klart-kriterier

1. `pytest` grönt (befintliga + alla nya tester), CI grön på GitHub.
2. `python main.py eval/fakturor/eval_01_korrekt.pdf` fungerar som förut
   OCH producerar revisionsprotokoll.
3. En genererad testfraktfaktura klassificeras som frakt och går genom
   fraktreglerna (extraktionssteget mockas i test; skarp körning görs
   när kvot finns).
4. Protokollet listar fynd från tull, moms och frakt med belopp, beräkning
   och referens.
