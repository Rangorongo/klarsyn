# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Tullsyn is a pipeline that reads a commercial invoice PDF, extracts structured
data via a Gemini LLM, and cross-checks it against EU TARIC customs data to flag
misclassifications and calculate potential duty refunds. Code comments, prompts,
and docstrings are written in Swedish; keep that convention when editing existing
files.

There is no README, requirements file, or test suite in this repo — this file and
the module docstrings are the primary documentation.

## Running the pipeline

```
python main.py
```

This runs `run_pipeline("sample_invoice.pdf")` (hardcoded in `main.py`'s
`__main__` block) and writes `audit_sample_invoice.pdf.csv` and
`audit_sample_invoice.pdf.pdf` to the repo root. To audit a different invoice,
change the path passed to `run_pipeline()`.

`check_models.py` lists which Gemini models the configured API key can call
(`genai.list_models()`), useful when `extractor.py`'s hardcoded model name
(`gemini-2.5-flash-lite`) needs to change.

`taric.py` has its own `__main__` block that runs sample HS-code/country lookups
directly against the TARIC data for quick debugging without needing a PDF or an
LLM call: `python taric.py`.

## Configuration

Requires a `.env` file in the repo root with `GOOGLE_API_KEY` (used by both
`extractor.py` and `check_models.py` via `python-dotenv`).

## Architecture

The pipeline is a straight-line flow orchestrated by a single-node LangGraph
`StateGraph` in `main.py::run_pipeline`, moving through four modules in order:

1. **`main.py`** — entry point. Loads the PDF text with `pdfplumber`
   (`load_pdf_text`), masks PII, builds the initial `CustomsGraphState`, runs the
   LangGraph app (currently a single `"agent"` node calling
   `extractor.extract_invoice_data`, then `END`), and hands the result to the
   audit + export step.

2. **`extractor.py`** — LLM extraction. Runs **two** sequential Gemini calls
   against the same `CustomsInvoice` structured-output schema:
   - Pass 1 (`_build_first_pass_prompt`): raw extraction from invoice text.
   - Pass 2 (`_build_self_check_prompt`): the model re-reads the original text
     alongside its own pass-1 JSON, corrects errors, and sets a per-item
     `confidence` (`"hög"`/`"låg"`) and `review_note`. The self-check prompt
     explicitly forbids reformatting `hs_code`/`country_of_origin` values
     (downstream code depends on the exact original format) and forbids
     inventing a `review_note` not grounded in the invoice text.
   - `_run_extraction` wraps both calls with one retry on 503/UNAVAILABLE
     (30s sleep then retry once); other exceptions propagate.
   - Only `final_output` (the pass-2 result, dumped to a plain dict) is written
     back into graph state. The `agent1_output`/`agent2_output`/`flag_disagreement`/
     `agent_winner`/`justification` fields in `CustomsGraphState` are defined but
     not populated by the current single-node graph — they read as scaffolding
     for a planned multi-agent-with-judge flow that hasn't been wired in yet.

3. **`customs_logic.py`** (`run_customs_audit`) — the "digital customs auditor".
   For each invoice item: looks up the item's real duty rate via `taric.py`,
   verifies the HS code's TARIC description, and appends human-readable
   `audit_flags` (⚠️ missing HS code/origin, 🔴 unrecognized HS code, 💰 unused
   FTA opportunity, 💶 estimated refund amount, 🔍 NAR rate needing manual
   check). Accumulates `potential_savings` assuming customs value = item price +
   (shipping cost split evenly across all items). Mutates and returns
   `final_output` with `audit_flags`, `potential_savings`, and `currency` added.

4. **`taric.py`** — local TARIC lookup layer. Reads four Excel files from
   `taric_data/` (`Duties Import 01-99.xlsx`, `Geographical areas
   description.xlsx`, `Geographical areas composition.xlsx`, `Nomenclature
   EN.xlsx`) into pandas DataFrames via `load_taric_data()`. Key rules:
   - EU-origin goods (`EU_COUNTRIES` set) always return 0% duty, no lookup needed.
   - HS codes are normalized by stripping dots and right-padding with zeros to
     10 digits (`"8534.00.00"` → `"8534000000"`) before matching `Goods code`.
   - MFN (erga omnes) duty is matched on `Meas. type code` in
     `{"103","105","106","109"}`; preferential/FTA duty on `{"142","145","146"}`,
     matched against the origin country by both code and name (`COUNTRY_NAME_MAP`
     maps ISO codes to the country names used in the TARIC country column).
   - A `Duty` value of `"NAR"` means a specific (non-percentage) rate that needs
     manual review — surfaced as `mfn_duty = "Kräver manuell kontroll (NAR)"`.

   `taric_data/` files are large (the duties file is ~8MB) and loaded fresh on
   every `run_customs_audit` call — there's no caching across pipeline runs.

5. **`utils.py`** — cross-cutting helpers, independent of the customs domain:
   - `mask_pii` — regex-based GDPR masking (currently only emails) applied to
     invoice text *before* it's sent to the LLM.
   - `save_to_csv` — flattens `final_output` via `pd.json_normalize`.
   - `save_to_pdf` — renders a full audit report with `reportlab`, using Arial
     fonts loaded from `C:/Windows/Fonts/` (Windows-only path — will break on
     non-Windows environments).

6. **`models.py`** — all Pydantic/TypedDict schemas: `InvoiceItem` and
   `CustomsInvoice` (the LLM's structured-output target) and
   `CustomsGraphState` (the LangGraph state dict threaded through `main.py`).

### Data flow summary

```
PDF → pdfplumber → mask_pii → LangGraph(extract_invoice_data: pass1 → self-check)
    → final_output dict → run_customs_audit (TARIC lookups + flags + savings)
    → save_to_csv / save_to_pdf
```
