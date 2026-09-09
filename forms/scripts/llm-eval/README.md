# LLM Automated PDF Field Mapping (`llm-eval`)

This directory contains two things built on the same schema-parsing foundation: `evaluate.py`, a benchmarking harness for comparing LLM accuracy at mapping PDF form fields to the Beyond Forms schema, and `generate_mapping.py`, which uses the same approach to actually fill in a real mapping TOML's `value` fields — turning dynamic **JEXL expressions** (`{{ ... }}`) generation from a benchmark into a usable tool.

---

## Structure

```
forms/scripts/llm-eval/
├── README.md                  # This active documentation file
├── schema_context.py          # Users columns + documents namespace -> schema context
├── evaluate.py                # Benchmark runner script (compares LLM output against a hand-written baseline)
├── generate_mapping.py        # Production tool: fills in blank `value`s in a real mapping TOML
├── profiles/                  # Decoupled mock testing citizen profiles
│   └── helmut_klar.json       # Helmut Klar MVP use-case concrete data values
├── prompts/                   # Prompt templates
│   ├── zero_shot.txt          # Strategy A: Baseline mapping prompt
│   ├── few_shot.txt           # Strategy B: Prompt with diverse concrete mapping examples
│   ├── rich_schema.txt        # Strategy C: Enhanced schema prompt (types, enums, null fallbacks)
│   ├── rich_schema_documents.txt # rich_schema.txt + the documents namespace - used by generate_mapping.py
│   └── self_correction.txt    # Reflection prompt for agentic JEXL syntax self-correction
└── results/                   # Compiled side-by-side comparative Markdown benchmark reports
```

---

## Overview

Large public benefit forms (such as `antrag_grunsicherung.toml`) contain over 409 fields. The execution harness slices boilerplate inputs into configurable chunks (default `CHUNK_SIZE = 100`) to prevent LLM output token truncation (e.g., 4k/8k window boundaries) and eliminate multi-key attention degradation.
The harness natively supports evaluating multiple LLM models sequentially across identical form structures. It creates consolidated side-by-side Markdown comparison reports detailing:

- **Exact Output Value Match Rate %**: Verification against established manual JEXL baselines.
- **JEXL Equivalence Rate %**: Functional validation of semantic JEXL equality.
- **Syntactic Compile Pass Rate %**: Python `pyjexl` execution stability.
- **Inference Velocity & Latency**: Processing execution seconds.

AcroForm IDs extracted directly from PDF binary stores frequently contain PDFDocEncoding or octal sequences (e.g., `\344` for `ä`, `\374` for `ü`). The suite includes an automated repair layer (`sanitize_json_response`) that resolves raw octal escape codes into standard Unicode hexadecimal representations (`\u00e4`).

## Results

### Prompt-strategy benchmark (`evaluate.py`, against a hand-written baseline)

| Model                                           | Exact Match %       | JEXL Equivalence %  | PyJEXL Compile Pass % | Latency | Technical Recommendation                                             |
| :---------------------------------------------- | :------------------ | :------------------ | :-------------------- | :------ | :------------------------------------------------------------------- |
| **`gemini-3.5-flash`**                          | **86.3%** (353/409) | **86.3%** (353/409) | **100.0%**            | ~234s   | 🏆 **Primary Target Engine (Superior Accuracy & Checkbox Handling)** |
| **`litert-community/gemma-4-E2B-it-litert-lm`** | **84.1%** (344/409) | **84.1%** (344/409) | **100.0%**            | ~15s    | ⚡ **Alternative Engine (Exceptional Peak UI Velocity)**             |

- **Manual Automation Impact**: The suite successfully proves that an LLM can completely eliminate **~86% of the mundane manual JEXL writing**, leaving only ~14% complex conditional translations (like specific legal health insurance sub-paragraphs) for developer inspection.

### Model choice for `generate_mapping.py` (2026-09-09)

Each candidate filled all 409 fields of `antrag_grundsicherung.toml` from scratch, same prompt (`rich_schema_documents`), same schema context including the `derived_context` namespace. "Agreement" is how many of the 111 values the reviewed mapping already held the model reproduced or wrote an equivalent of, evaluated across both profiles in `profiles/`. "Crashes" counts expressions that raise on either the populated or the empty stand-in context.

| Model                    | Fields mapped | Agreement (of 111) | Reaches person namespace | Crashing expressions |
| :----------------------- | ------------: | -----------------: | -----------------------: | -------------------: |
| **`gemini-3.7-flash`**   |           147 |     **63 (57 %)**  |                       16 |                    5 |
| `gemini-3.8-flash`       |           128 |          59 (53 %) |                       16 |                    4 |
| `gemini-3.5-flash`       |           207 |          58 (52 %) |                   **41** |                   12 |
| `gemini-3.1-pro-preview` |           108 |          52 (47 %) |                       13 |                    2 |
| `gemini-3.5-flash-lite`  |           114 |          40 (36 %) |                       16 |                    2 |

`gemini-3.7-flash` is the default. `gemini-3.5-flash-lite` — the previous default — was the weakest of the five and was also the only one that failed to answer for every field it was asked about (308 of 409); the others all returned a complete set.

Read the percentages as relative, not absolute: the 111-field baseline is whatever the mapping happened to hold, and equivalence is only checked against two profiles. `gemini-3.5-flash`'s much higher coverage is worth noting — it guesses more, which produces both more usable drafts and more than twice as many crashing expressions as any other candidate.


---

## Usage

Always use `uv run` to execute benchmark evaluation runs from the project repository root.

### 1. Single Model Execution Runner

```bash
uv run forms/scripts/llm-eval/evaluate.py \
  --models gemini-3.5-flash \
  --form antrag_grunsicherung \
  --prompt rich_schema \
  --chunk-size 100
```

### 2. Multi-Model Side-by-Side Comparison Matrix

To benchmark Gemini against Gemma side-by-side:

```bash
uv run forms/scripts/llm-eval/evaluate.py \
  --models gemini-3.5-flash litert-community/gemma-4-E2B-it-litert-lm \
  --form antrag_grunsicherung \
  --prompt rich_schema \
  --profile-dir forms/scripts/llm-eval/profiles \
  --chunk-size 100
```

### 3. Mitigating Single-Profile Bias (Parallel Multi-Profile Auditing)

To ensure that expressions are functionally equivalent and not just getting false-positive matches on a single persona's attributes, the harness natively scans a directory of citizens (`--profile-dir`) or an explicit list of JSON profiles (`--profiles`) and evaluates candidates in parallel using high-performance thread pools:

```bash
uv run forms/scripts/llm-eval/evaluate.py \
  --models gemini-3.5-flash \
  --form antrag_grunsicherung \
  --profile-dir forms/scripts/llm-eval/profiles \
  --chunk-size 100
```

### 3. Enabling Agentic Self-Correction

To instruct the suite to invoke a reflection pass (`self_correction.txt`) whenever a runtime `pyjexl` syntax crash occurs:

```bash
uv run forms/scripts/llm-eval/evaluate.py \
  --models gemini-3.5-flash \
  --form test_form \
  --self-correct
```

### Outputs

1.  **Console Diff**: A full Git-style terminal diff illustrating key baseline JEXL strings against LLM generated alternatives.
2.  **Markdown Comparative Report**: An extensively detailed Markdown benchmarking report auto-saved to `forms/scripts/llm-eval/results/eval_report_<timestamp>.md` highlighting overarching metrics and line-by-line discrepancy status.

### 4. Measuring the `documents` namespace (`--no-documents`)

`evaluate.py`'s schema context always includes the `documents` namespace (OCR fields per document type) unless `--no-documents` is passed, which reproduces the exact schema shape behind the recorded 86.3% figure above. To A/B whether adding the `documents` namespace helps or hurts a given prompt/model:

```bash
uv run forms/scripts/llm-eval/evaluate.py --form antrag_grundsicherung --prompt rich_schema_documents --models gemini-3.5-flash
uv run forms/scripts/llm-eval/evaluate.py --form antrag_grundsicherung --prompt rich_schema_documents --models gemini-3.5-flash --no-documents
```

---

## Generating a real mapping (`generate_mapping.py`)

Unlike `evaluate.py`, this doesn't need a pre-existing baseline to diff against — it fills in the blanks of a boilerplate TOML produced by `forms/scripts/extract_to_mapping.sh` and writes the result back in place. It never touches `type`/`description`/`options`, only `value`.

```bash
uv run forms/scripts/llm-eval/generate_mapping.py --form forms/mappings/antrag_bewohnerparkausweis.toml
```

Useful flags:

- `--dry-run` — print what would change without writing the file.
- `--overwrite-existing` — also regenerate fields that already have a non-empty `value` (default: only fills blanks, so re-running never clobbers a reviewed hand-written value).
- `--self-correct` — run a reflection pass (`prompts/self_correction.txt`) on any JEXL that fails to parse.
- `--model` / `--chunk-size` — same meaning as in `evaluate.py`. The default model is `gemini-3.7-flash` (see the model comparison above).

Every generated expression is checked before it is written, and anything that fails is reset to blank rather than shipped:

- the identifier must be a real `users` column, a `derived_context` key, or a real `documents.<slug>.<field>`;
- a `partner.…` / `household_members[i].…` field must exist on `associated_persons`, and an `income.…` / `expenses.…` / `assets.…` key must be a real enum value;
- the expression must evaluate without raising against **two** stand-in contexts — one where every column is populated, one where every column is null and there is no partner, no household and no uploaded document. The second is what forces the guarded house style: `{{ 'Stocks' in assets_types ? … }}` and `{{ partner.first_name }}` both pass the first context and crash on the second.

### The `derived_context` namespace

`generate_mapping.py` passes `include_derived=True`, which adds a third namespace to the schema context beside `user_columns` and `documents`. Its key list is built by *calling* `form_context.derived_context()` with stand-in values, so it cannot drift from what the running service supplies. It holds:

- `partner`, `household_members[i]`, `associated_persons[i]` — the `associated_persons` rows, so a form's Person 2..N slots have a source at all. Without it every such slot was either blank or, worse, filled from the applicant's own columns.
- `income`, `expenses`, `assets` and their `_office` / `_reference` / `_notes` / `_descriptions` companions — the repeating money grids, keyed by the enum value naming the form row.
- `today`, `age`, `is_adult`, `has_reached_retirement_age`, `marital_status_de`, `nationality_de`, `household_members_count`.

`evaluate.py` takes a `--derived` flag for the same thing; it is off by default there so the recorded control run above stays reproducible.

The output is **AI-drafted and must be reviewed by a human before use** — the written file carries a header comment saying so until it's removed. See `forms/README.md` for the full workflow (extract skeleton → generate values → validate).
