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

| Model                                           | Exact Match %       | JEXL Equivalence %  | PyJEXL Compile Pass % | Latency | Technical Recommendation                                             |
| :---------------------------------------------- | :------------------ | :------------------ | :-------------------- | :------ | :------------------------------------------------------------------- |
| **`gemini-3.5-flash`**                          | **86.3%** (353/409) | **86.3%** (353/409) | **100.0%**            | ~234s   | 🏆 **Primary Target Engine (Superior Accuracy & Checkbox Handling)** |
| **`litert-community/gemma-4-E2B-it-litert-lm`** | **84.1%** (344/409) | **84.1%** (344/409) | **100.0%**            | ~15s    | ⚡ **Alternative Engine (Exceptional Peak UI Velocity)**             |

- **Manual Automation Impact**: The suite successfully proves that an LLM can completely eliminate **~86% of the mundane manual JEXL writing**, leaving only ~14% complex conditional translations (like specific legal health insurance sub-paragraphs) for developer inspection.

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
uv run forms/scripts/llm-eval/generate_mapping.py --form antrag_bewohnerparkausweis
```

Useful flags:

- `--dry-run` — print what would change without writing the file.
- `--overwrite-existing` — also regenerate fields that already have a non-empty `value` (default: only fills blanks, so re-running never clobbers a reviewed hand-written value).
- `--self-correct` — run a reflection pass (`prompts/self_correction.txt`) on any JEXL that fails to parse.
- `--model` / `--chunk-size` — same meaning as in `evaluate.py`.

The output is **AI-drafted and must be reviewed by a human before use** — the written file carries a header comment saying so until it's removed. See `forms/README.md` for the full workflow (extract skeleton → generate values → validate).
