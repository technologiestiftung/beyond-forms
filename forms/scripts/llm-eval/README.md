# LLM Automated PDF Field Mapping Evaluation (`llm-eval`)

This directory contains benchmarking scripts and configuration files for evaluating and comparing LLM accuracy in automatically mapping arbitrary PDF form fields to the structured database schema of Beyond Forms using dynamic **JEXL expressions** (`{{ ... }}`).

---

## Structure

```
forms/scripts/llm-eval/
├── README.md              # This active documentation file
├── evaluate.py            # Complete evaluation and comparative benchmark runner script
├── profiles/              # Decoupled mock testing citizen profiles
│   └── helmut_klar.json   # Helmut Klar MVP use-case concrete data values
├── prompts/               # Prompt templates under test
│   ├── zero_shot.txt      # Strategy A: Baseline mapping prompt
│   ├── few_shot.txt       # Strategy B: Prompt with diverse concrete mapping examples
│   ├── rich_schema.txt    # Strategy C: Enhanced schema prompt (types, enums, null fallbacks)
│   └── self_correction.txt# Reflection prompt for agentic JEXL syntax self-correction
└── results/               # Compiled side-by-side comparative Markdown benchmark reports
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
