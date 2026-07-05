# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Tullsyn is a modular invoice-audit system for importing SMEs. It reads invoice
PDFs, extracts structured data via Gemini LLMs, cross-checks against reference
data, and produces decision reports plus a formal revision protocol (the basis
for amendment applications to Tullverket or claims against carriers). Two audit
modules share a common core: **customs** (TARIC-based duty audit + VAT
consequence) and **freight** (contract-free carrier-invoice checks).

Code comments, prompts, docstrings, and test names are written in Swedish;
keep that convention when editing existing files.

## Running

```
python main.py                          # audits sample_invoice.pdf (customs)
python main.py path/to/invoice.pdf      # single invoice, type auto-detected
python main.py folder/                  # all PDFs in folder + batch summary
python main.py file.pdf --modul frakt   # force module (tull|frakt)
pytest                                  # full quota-free test suite
python eval/kor_eval.py                 # accuracy eval (15 Gemini calls!)
python eval/generera_testfakturor.py    # regenerate customs eval PDFs (free)
python eval/generera_fraktfakturor.py   # regenerate freight test PDF (free)
python modules/customs/taric.py         # TARIC lookups without any LLM calls
```

Every run writes per-invoice `audit_<name>.csv`/`.pdf` next to the invoice,
plus `revisionsprotokoll_<date>.pdf` (numbered findings with amounts,
calculations, references). Folder runs also write `batch_sammanfattning.pdf`.

Requires `.env` with `GOOGLE_API_KEY` and the four TARIC Excel files in
`taric_data/` (download from CIRCABC, updated monthly — see README).

## Architecture

```
main.py                 CLI + orchestration: hitta_fakturor → granska_dokument
                        (doc-type routing) → kor_batch → reports + protocol
core/
  llm_klient.py         anropa_strukturerat(): Gemini call with automatic
                        model rotation on 429 (each free model has own quota),
                        30s retry on 503, other errors propagate
  extraktion.py         extrahera_tva_pass(text, schema, prompt_builders):
                        generic two-pass extract + self-check, module-agnostic
  dokumenttyp.py        deterministic keyword classifier tull/frakt; raises
                        ValueError telling user to pass --modul when ambiguous
  pii.py                mask_pii() applied before any LLM call (GDPR)
  rapporter.py          save_to_csv / save_to_pdf (decision report) /
                        save_batch_summary / save_revision_protocol.
                        reportlab platypus; emoji→text tags (Arial lacks emoji);
                        Windows-only font paths C:/Windows/Fonts/
modules/customs/
  schema.py             CustomsInvoice/InvoiceItem (LLM target, confidence +
                        review_note per item), HSMatch* (verifier target),
                        CustomsGraphState (LangGraph state)
  prompts.py            two-pass prompts; self-check forbids reformatting
                        hs_code/country and inventing review_notes
  pipeline.py           extract_invoice_data LangGraph node
  taric.py              local TARIC lookups: date-valid rows only
                        (_giltiga_rader, DD-MM-YYYY), HS normalize
                        (strip dots, ljust(10,'0')), EU_COUNTRIES → 0% direct,
                        MFN = ERGA OMNES + measure 103/105/106/109,
                        preference = 142/145/146 matched on code AND name
                        (COUNTRY_NAME_MAP), NAR/'Cond:' → manual-check duty,
                        lookup_antidumping = measure 551–554.
                        Module-level cache: Excel (~8MB) loaded once per run
  verifier.py           verify_hs_matches(): ONE batched Gemini call judging
                        invoice-description vs TARIC-description (ja/nej/osäker);
                        returns None on total failure (graceful degradation)
  rules.py              run_customs_audit(): flags, structured findings,
                        verdicts (grön/gul/röd per item; röda skäl > gula),
                        potential_savings (honest upper bound, only if has_fta),
                        potential_vat (= savings × MOMSSATS 0.25, avdragsgill
                        disclaimer), action_items sorted hög→medel
modules/freight/
  schema.py             FreightInvoice/Shipment/SurchargeLine
  facit.py              volymviktsdivisor per carrier (default 5000, tnt 4000),
                        VIKTTOLERANS_KG 0.5, BELOPPSTOLERANS 0.05,
                        MAX_PROCENTTILLAGG 35
  prompts.py            freight two-pass prompts (preserve tracking exactly)
  rules.py              run_freight_audit(): duplicate tracking (röd, savings),
                        missing tracking (gul), volumetric-weight overbilling
                        (röd), line/invoice sum checks, >35% surcharges (gul),
                        low confidence (gul). Same verdict/finding/action shape
                        as customs — reports work unchanged
```

### Conventions that must not break

- Fields missing from an invoice are None — the LLM must never invent data.
- hs_code / country_of_origin / tracking_number keep their exact original
  format end-to-end (downstream matching depends on it).
- Savings/VAT amounts are always phrased as upper bounds pending verification
  against the import declaration; the report never promises money.
- findings (kategori/objekt/beskrivning/belopp/berakning/referens/atgard) are
  appended at the same code sites as their audit_flags so they never diverge.
- Excel is always read with dtype=str (leading zeros in Goods code).
- Quota: customs run = 3 Gemini calls (2 extraction + 1 verify), freight = 2.
  Free-tier quotas reset midnight Pacific (09:00 Swedish); llm_klient rotates
  models automatically on 429.

## Tests and CI

`pytest` (95+ tests) runs without network, API key, or taric_data/: TARIC
logic uses synthetic DataFrames (tests/conftest.py fixtures), rules tests
monkeypatch `modules.customs.rules.load_taric_data`/`verify_hs_matches`,
LLM rotation uses fake models, PDF smoke tests skip without Arial. One
integration test reads real taric_data/ when present. GitHub Actions
(windows-latest) runs the suite on every push. pytest.ini sets pythonpath=.

`eval/` holds test invoices with planted errors + facit.json; kor_eval.py
measures accuracy (last full run: 16/16). Eval PDFs are regenerable scripts —
safe to commit.

## Docs

Specs and plans live in docs/superpowers/ (specs/, plans/); future module
plans in docs/moduler/ (freight V2: carrier indices, customer contracts, GSR —
needs external data). The marketing site lives in the separate public repo
Rangorongo/tullsyn-web; this repo is private.
