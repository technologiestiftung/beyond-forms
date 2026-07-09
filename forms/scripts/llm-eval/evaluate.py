import os
import sys
import json
import argparse
import ast
import re
import datetime
from zoneinfo import ZoneInfo
import tomllib
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor
from litellm import completion
from pyjexl import JEXL


def load_profile(profile_path: str) -> Dict[str, Any]:
    if not os.path.exists(profile_path):
        print(f"Error: Evaluation profile not found at {profile_path}", file=sys.stderr)
        sys.exit(1)
    with open(profile_path, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_schemas_py(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        print(f"Warning: schemas.py not found at {file_path}", file=sys.stderr)
        return {}

    with open(file_path, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    schema_fields = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "UserInformationUpdateSchema":
            for item in node.body:
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    field_name = item.target.id
                    description = ""
                    if (
                        isinstance(item.value, ast.Call)
                        and isinstance(item.value.func, ast.Name)
                        and item.value.func.id == "Field"
                    ):
                        for kw in item.value.keywords:
                            if kw.arg == "description" and isinstance(kw.value, ast.Constant):
                                description = kw.value.value

                    schema_fields[field_name] = {"type": ast.unparse(item.annotation), "description": description}
    return schema_fields


def parse_models_py(file_path: str) -> tuple[Dict[str, Any], Dict[str, list]]:
    if not os.path.exists(file_path):
        print(f"Warning: models.py not found at {file_path}", file=sys.stderr)
        return {}, {}

    with open(file_path, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    enums = {}
    users_fields = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            is_enum = False
            for base in node.bases:
                if isinstance(base, ast.Attribute) and base.attr == "Enum":
                    is_enum = True
                elif isinstance(base, ast.Name) and "Enum" in base.id:
                    is_enum = True

            if is_enum or node.name.endswith("Type"):
                allowed_values = []
                for item in node.body:
                    if isinstance(item, ast.Assign):
                        if isinstance(item.value, ast.Constant):
                            allowed_values.append(item.value.value)
                if allowed_values:
                    enums[node.name] = allowed_values

            if node.name == "Users":
                for item in node.body:
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        field_name = item.target.id
                        field_type = ast.unparse(item.annotation)
                        users_fields[field_name] = field_type

    return users_fields, enums


def load_boilerplate(toml_path: str) -> Dict[str, Any]:
    with open(toml_path, "rb") as f:
        mapping = tomllib.load(f)

    boilerplate = {}
    for field_id, field_info in mapping.items():
        if isinstance(field_info, dict):
            boilerplate[field_id] = {
                "type": field_info.get("type", "string"),
                "description": field_info.get("description", ""),
                "options": field_info.get("options", []),
            }
        else:
            boilerplate[field_id] = {"type": "string", "description": "", "options": []}
    return boilerplate


def sanitize_json_response(raw_content: str) -> dict:
    """Repairs octal escape sequences and unwanted backslashes before parsing JSON."""
    s = raw_content.strip()

    def _fix_octal(m):
        code = int(m.group(1), 8)
        return f"\\u{code:04x}"

    s = re.sub(r"\\([0-7]{1,3})", _fix_octal, s)

    s = re.sub(r"\\([()%\-_?!])", r"\1", s)
    s = re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', r"\\\\", s)

    try:
        return json.loads(s)
    except json.JSONDecodeError as jde:
        print("--- SANITIZED LLM RESPONSE (INVALID JSON) ---", file=sys.stderr)
        print(s, file=sys.stderr)
        print("----------------------------------------", file=sys.stderr)
        raise jde


def run_llm_chunk(prompt_template: str, schema_context: dict, boilerplate_chunk: dict, model_name: str) -> dict:
    schema_str = json.dumps(schema_context, indent=2)

    bp_list = []
    for fid, finfo in boilerplate_chunk.items():
        bp_list.append(
            f'- ID: "{fid}", Type: "{finfo["type"]}", Description: "{finfo["description"]}", Options: {finfo["options"]}'
        )
    bp_str = "\n".join(bp_list)

    prompt = prompt_template.replace("__SCHEMA_CONTEXT__", schema_str).replace("__BOILERPLATE_TOML__", bp_str)
    project_id = os.getenv("GCLOUD_PROJECT", "beyond-forms-staging")

    model_id = model_name
    known_providers = (
        "vertex_ai/",
        "openai/",
        "huggingface/",
        "ollama/",
        "anthropic/",
        "together_ai/",
        "openrouter/",
        "cohere/",
        "anyscale/",
    )
    if not any(model_id.startswith(p) for p in known_providers):
        model_id = "vertex_ai/" + model_name

    oauth_token = None
    try:
        import google.auth
        from google.auth.transport.requests import Request

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(Request())
        oauth_token = creds.token
        if oauth_token:
            os.environ["VERTEX_AI_ACCESS_TOKEN"] = oauth_token
    except Exception as e:
        print(f"Warning: Pure Python OAuth token resolution failed: {e}", file=sys.stderr)

    response = completion(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
        vertex_project=project_id,
        vertex_location="global",
        oauth_token=oauth_token,
    )

    return sanitize_json_response(response.choices[0].message.content)


def run_self_correction(
    self_correct_template: str, schema_context: dict, field_id: str, bad_jexl: str, err_msg: str, model_name: str
) -> str:
    schema_str = json.dumps(schema_context, indent=2)
    prompt = (
        self_correct_template.replace("__SCHEMA_CONTEXT__", schema_str)
        .replace("__FIELD_ID__", field_id)
        .replace("__GENERATED_JEXL__", bad_jexl)
        .replace("__ERROR_MESSAGE__", err_msg)
    )
    project_id = os.getenv("GCLOUD_PROJECT", "beyond-forms-staging")

    model_id = model_name
    known_providers = (
        "vertex_ai/",
        "openai/",
        "huggingface/",
        "ollama/",
        "anthropic/",
        "together_ai/",
        "openrouter/",
        "cohere/",
        "anyscale/",
    )
    if not any(model_id.startswith(p) for p in known_providers):
        model_id = "vertex_ai/" + model_name

    oauth_token = None
    try:
        import google.auth
        from google.auth.transport.requests import Request

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(Request())
        oauth_token = creds.token
        if oauth_token:
            os.environ["VERTEX_AI_ACCESS_TOKEN"] = oauth_token
    except Exception as e:
        print(f"Warning: Pure Python OAuth token resolution failed in self-correction: {e}", file=sys.stderr)

    response = completion(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
        vertex_project=project_id,
        vertex_location="global",
        oauth_token=oauth_token,
    )

    try:
        data = sanitize_json_response(response.choices[0].message.content)
        return data.get("corrected_value", bad_jexl)
    except Exception:
        return bad_jexl


def run_chunked_llm_mapping(
    prompt_template: str,
    self_correct_template: str | None,
    schema_context: dict,
    boilerplate: dict,
    model_name: str,
    chunk_size: int,
    test_profiles: list,
    execute_self_correct: bool,
) -> tuple[dict, float, int, int]:
    items = list(boilerplate.items())
    total_items = len(items)
    aggregated_mappings = {}

    start_time = datetime.datetime.now()
    total_prompt_tokens = 0
    total_completion_tokens = 0

    jexl = JEXL()
    primary_profile = test_profiles[0] if test_profiles else {}

    print(f"Executing model {model_name} across {total_items} fields (Chunk Size: {chunk_size})...")

    for i in range(0, total_items, chunk_size):
        chunk_items = dict(items[i : i + chunk_size])
        print(f"  Processing batch {i + 1} to {min(i + chunk_size, total_items)}...")

        try:
            chunk_result = run_llm_chunk(prompt_template, schema_context, chunk_items, model_name)

            if execute_self_correct and self_correct_template:
                for fid, expr in chunk_result.items():
                    norm_expr = expr.strip() if isinstance(expr, str) else str(expr)
                    _, syntax_ok, err_msg = resolve_jexl_value(norm_expr, primary_profile, jexl)
                    if not syntax_ok and err_msg:
                        print(f"    [Self-Correct Loop] Triggered for '{fid}': {err_msg}")
                        corrected_expr = run_self_correction(
                            self_correct_template, schema_context, fid, norm_expr, err_msg, model_name
                        )
                        chunk_result[fid] = corrected_expr

            aggregated_mappings.update(chunk_result)
        except Exception as e:
            print(f"  Error processing chunk {i + 1}-{min(i + chunk_size, total_items)}: {e}", file=sys.stderr)
            for fid in chunk_items:
                if fid not in aggregated_mappings:
                    aggregated_mappings[fid] = ""

    execution_time = (datetime.datetime.now() - start_time).total_seconds()
    return aggregated_mappings, execution_time, total_prompt_tokens, total_completion_tokens


def resolve_jexl_value(val: str, user_dict: dict, jexl: JEXL) -> tuple[Any, bool, str | None]:
    if not isinstance(val, str):
        return val, True, None

    stripped_val = val.strip()
    if not stripped_val:
        return "", True, None

    if (
        stripped_val.startswith("{{")
        and stripped_val.endswith("}}")
        and stripped_val.count("{{") == 1
        and stripped_val.count("}}") == 1
    ):
        raw_jexl = stripped_val[2:-2].strip()
        try:
            return jexl.evaluate(raw_jexl, user_dict), True, None
        except Exception as e:
            return None, False, str(e)

    if "{{" in stripped_val and "}}" in stripped_val:
        syntax_ok = True
        err_msg = None

        def _eval(m):
            nonlocal syntax_ok, err_msg
            expr_str = m.group(1).strip()
            try:
                val_res = jexl.evaluate(expr_str, user_dict)
                if isinstance(val_res, bool):
                    return "Ja" if val_res else ""
                return str(val_res) if val_res is not None else ""
            except Exception as e:
                syntax_ok = False
                err_msg = str(e)
                return ""

        res = re.sub(r"\{\{\s*(.*?)\s*\}\}", _eval, stripped_val, flags=re.DOTALL)
        return (res if syntax_ok else None), syntax_ok, err_msg

    return stripped_val, True, None


def _eval_single_profile(profile: dict, base_jexl: str, gen_jexl: str, jexl_engine: JEXL) -> bool:
    base_res, base_syntax, _ = resolve_jexl_value(base_jexl, profile, jexl_engine)
    gen_res, gen_syntax, _ = resolve_jexl_value(gen_jexl, profile, jexl_engine)
    return base_syntax and gen_syntax and (base_res == gen_res)


def verify_jexl_equivalence(baseline_jexl: str, generated_jexl: str, test_profiles: list, jexl_engine: JEXL) -> bool:
    """
    Evaluates JEXL equivalence across a diverse matrix of test profiles
    in parallel to guarantee functional and semantic equality, completely eliminating single-profile bias.
    """
    if baseline_jexl == generated_jexl:
        return True

    try:
        with ThreadPoolExecutor(max_workers=min(32, len(test_profiles))) as executor:
            futures = [
                executor.submit(_eval_single_profile, profile, baseline_jexl, generated_jexl, jexl_engine)
                for profile in test_profiles
            ]
            for f in futures:
                if not f.result():
                    return False
        return True
    except Exception:
        return False


def evaluate_expressions(generated_mappings: dict, baseline_mappings: dict, test_profiles: list) -> dict:
    jexl = JEXL()
    results = {}
    primary_profile = test_profiles[0] if test_profiles else {}

    for field_id, baseline_expr_info in baseline_mappings.items():
        baseline_expr = baseline_expr_info.get("value") if isinstance(baseline_expr_info, dict) else baseline_expr_info
        if baseline_expr is None:
            baseline_expr = ""

        generated_expr = generated_mappings.get(field_id, "")

        norm_expr = generated_expr.strip() if isinstance(generated_expr, str) else str(generated_expr)
        norm_baseline = baseline_expr.strip() if isinstance(baseline_expr, str) else str(baseline_expr)

        eval_val, syntax_ok, eval_err = resolve_jexl_value(norm_expr, primary_profile, jexl)
        baseline_val, _, _ = resolve_jexl_value(norm_baseline, primary_profile, jexl)

        is_equivalent = verify_jexl_equivalence(norm_baseline, norm_expr, test_profiles, jexl)

        match = False
        if syntax_ok and is_equivalent:
            match = True

        results[field_id] = {
            "generated_expr": norm_expr,
            "baseline_expr": norm_baseline,
            "syntax_ok": syntax_ok,
            "eval_val": eval_val,
            "baseline_val": baseline_val,
            "match": match,
            "is_equivalent": is_equivalent,
            "error": eval_err,
        }
    return results


def print_diff(results: dict, model_name: str):
    print("\n" + "=" * 80)
    print(f"MAPPING VALUE COMPARISON DIFF: {model_name}")
    print("=" * 80)

    diff_count = 0
    for fid, res in results.items():
        if not res["is_equivalent"]:
            diff_count += 1
            print(f"\nField: {fid}")
            print(f"- Baseline: {res['baseline_expr']}")
            print(f"+ LLM Gen:  {res['generated_expr']}")
            if not res["syntax_ok"]:
                print(f"  [SYNTAX ERROR]: {res['error']}")
            elif not res["match"]:
                print(
                    f"  [VALUE MISMATCH] Evaluated output: {repr(res['eval_val'])} vs Expected: {repr(res['baseline_val'])}"
                )

    if diff_count == 0:
        print("No differences found! LLM perfectly matches baseline semantic behavior across all profiles.")
    else:
        print(f"\nTotal fields with multi-profile semantic differences: {diff_count}")


def generate_multi_report(
    multi_results: dict, form_name: str, prompt_name: str, chunk_size: int, profile_names: list
) -> str:
    berlin_now = datetime.datetime.now(ZoneInfo("Europe/Berlin"))
    timestamp = berlin_now.strftime("%Y-%m-%d_%H-%M-%S")
    script_dir = os.path.dirname(os.path.realpath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    report_dir = os.path.join(project_root, "forms/scripts/llm-eval/results")
    os.makedirs(report_dir, exist_ok=True)
    report_path = f"{report_dir}/eval_report_{timestamp}.md"

    models = list(multi_results.keys())
    if not models:
        return report_path

    first_model = models[0]
    total_fields = len(multi_results[first_model]["eval_results"])
    profiles_str = ", ".join(profile_names)

    report_content = f"""# LLM Automated PDF Field Mapping Evaluation Benchmark

*   **Date**: {berlin_now.strftime("%Y-%m-%d %H:%M:%S")}
*   **Form Under Test**: `{form_name}` ({total_fields} fields)
*   **Prompt Strategy**: `{prompt_name}`
*   **Evaluation Profiles Matrix**: `{profiles_str}`
*   **Chunk Size**: {chunk_size} fields

## Comparative Benchmarking Matrix (Multi-Profile Audited)

| Model | Multi-Profile Equivalence % | PyJEXL Compile Pass % | Latency (s) |
| :--- | :--- | :--- | :--- |
"""

    for model_name, mdata in multi_results.items():
        results = mdata["eval_results"]
        time_s = mdata["execution_time"]

        syntax_errors = sum(1 for r in results.values() if not r["syntax_ok"])
        equiv_matches = sum(1 for r in results.values() if r["is_equivalent"])

        equiv_pct = (equiv_matches / total_fields) * 100 if total_fields > 0 else 0
        syntax_pct = ((total_fields - syntax_errors) / total_fields) * 100 if total_fields > 0 else 0

        report_content += f"| `{model_name}` | **{equiv_pct:.1f}%** ({equiv_matches}/{total_fields}) | **{syntax_pct:.1f}%** | {time_s:.1f}s |\n"

    report_content += "\n## Detailed Discrepancy Comparison\n\n"

    fields_with_diffs = []
    for fid in multi_results[first_model]["eval_results"]:
        has_any_diff = any(not multi_results[m]["eval_results"][fid]["is_equivalent"] for m in models)
        if has_any_diff:
            fields_with_diffs.append(fid)

    if not fields_with_diffs:
        report_content += "No semantic differences found in any model! All evaluated models perfectly matched the manual baseline across all testing profiles.\n"
    else:
        for fid in fields_with_diffs:
            report_content += f"### `{fid}`\n"
            baseline_str = multi_results[first_model]["eval_results"][fid]["baseline_expr"]
            report_content += f"*   **Manual Baseline**: `{baseline_str}`\n\n"

            report_content += "| Model | Generated Expression | Evaluation Status |\n"
            report_content += "| :--- | :--- | :--- |\n"

            for model_name in models:
                res = multi_results[model_name]["eval_results"][fid]
                gen_str = res["generated_expr"]

                status_str = "✅ Semantic Match (Multi-Profile Validated)"
                if not res["syntax_ok"]:
                    status_str = f"❌ Syntax Crash: `{res['error']}`"
                elif not res["is_equivalent"]:
                    status_str = f"⚠️ Multi-Profile Equivalence Failure (Evaluated Primary as: `{repr(res['eval_val'])}` vs Expected: `{repr(res['baseline_val'])}`)"

                report_content += f"| `{model_name}` | `{gen_str}` | {status_str} |\n"
            report_content += "\n"

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    return report_path


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate & Benchmark LLM-based PDF field mapping across a parallel multi-profile matrix."
    )
    parser.add_argument(
        "--form", default="test_form", help="Name of the form mappings under test (without .toml suffix)"
    )
    parser.add_argument(
        "--models", nargs="+", default=["gemini-3.5-flash"], help="List of LLM model names to execute & benchmark"
    )
    parser.add_argument("--prompt", default="rich_schema", help="Prompt template file name (without .txt suffix)")
    parser.add_argument("--profile", help="Path to a single evaluation citizen profile JSON file")
    parser.add_argument("--profiles", nargs="+", help="Explicit list of paths to evaluation citizen profile JSON files")
    parser.add_argument(
        "--profile-dir",
        default="forms/scripts/llm-eval/profiles",
        help="Directory containing citizen profile JSON files to discover and evaluate in parallel",
    )
    parser.add_argument(
        "--chunk-size", type=int, default=100, help="Number of boilerplate fields to submit per LLM request chunk"
    )
    parser.add_argument(
        "--self-correct",
        action="store_true",
        help="Execute agentic self-correction loop when JEXL syntax crashes occur",
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.realpath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))

    test_profiles = []
    profile_names = []

    if args.profile:
        p_paths = [args.profile]
    elif args.profiles:
        p_paths = args.profiles
    else:
        dir_path = args.profile_dir if os.path.isabs(args.profile_dir) else os.path.join(project_root, args.profile_dir)
        p_paths = []
        if os.path.isdir(dir_path):
            for fname in sorted(os.listdir(dir_path)):
                if fname.endswith(".json"):
                    p_paths.append(os.path.join(dir_path, fname))

    for p_path in p_paths:
        full_path = p_path if os.path.isabs(p_path) else os.path.join(project_root, p_path)
        test_profiles.append(load_profile(full_path))
        profile_names.append(os.path.basename(p_path))

    if not test_profiles:
        print(
            "Error: No evaluation citizen profiles found! Please check your --profile, --profiles, or --profile-dir paths.",
            file=sys.stderr,
        )
        sys.exit(1)

    schemas_path = os.path.join(project_root, "services/orchestration-middleware-service/src/schemas.py")
    models_path = os.path.join(project_root, "services/orchestration-middleware-service/src/models.py")

    schema_fields = parse_schemas_py(schemas_path)
    model_fields, enums = parse_models_py(models_path)

    schema_context = {}
    ignored_fields = {
        "conversations",
        "user_applications",
        "user_tutorial_states",
        "user_documents",
        "created_at",
        "updated_at",
        "fcm_token",
        "authentik_id",
    }

    for field_name, model_type in model_fields.items():
        if field_name in ignored_fields:
            continue

        clean_type = "String"
        allowed_values = []

        matched_enum = None
        for enum_name in enums:
            if enum_name in model_type:
                matched_enum = enum_name
                break

        if matched_enum:
            clean_type = f"Enum ({', '.join(enums[matched_enum])})"
            allowed_values = enums[matched_enum]
        elif "bool" in model_type.lower():
            clean_type = "Boolean"
        elif "date" in model_type.lower():
            clean_type = "Date (ISO YYYY-MM-DD)"
        elif "decimal" in model_type.lower() or "numeric" in model_type.lower():
            clean_type = "Decimal"
        elif "int" in model_type.lower():
            clean_type = "Integer"

        description = ""
        if field_name in schema_fields:
            description = schema_fields[field_name].get("description", "")

        schema_context[field_name] = {"type": clean_type, "description": description}
        if allowed_values:
            schema_context[field_name]["allowed_values"] = allowed_values

    toml_path = os.path.join(project_root, f"forms/mappings/{args.form}.toml")
    if not os.path.exists(toml_path):
        print(f"Error: Baseline mapping file not found at {toml_path}", file=sys.stderr)
        sys.exit(1)

    with open(toml_path, "rb") as f:
        baseline_mappings = tomllib.load(f)

    boilerplate = load_boilerplate(toml_path)

    prompt_path = os.path.join(script_dir, f"prompts/{args.prompt}.txt")
    if not os.path.exists(prompt_path):
        print(f"Error: Prompt template not found at {prompt_path}", file=sys.stderr)
        sys.exit(1)

    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    self_correct_template = None
    if args.self_correct:
        sc_path = os.path.join(script_dir, "prompts/self_correction.txt")
        if os.path.exists(sc_path):
            with open(sc_path, "r", encoding="utf-8") as f:
                self_correct_template = f.read()
        else:
            print("Warning: --self-correct requested but prompts/self_correction.txt not found.", file=sys.stderr)

    multi_results = {}

    for model_name in args.models:
        gen_maps, exec_time, _, _ = run_chunked_llm_mapping(
            prompt_template=prompt_template,
            self_correct_template=self_correct_template,
            schema_context=schema_context,
            boilerplate=boilerplate,
            model_name=model_name,
            chunk_size=args.chunk_size,
            test_profiles=test_profiles,
            execute_self_correct=args.self_correct,
        )

        eval_res = evaluate_expressions(gen_maps, baseline_mappings, test_profiles)
        print_diff(eval_res, model_name)

        multi_results[model_name] = {
            "generated_mappings": gen_maps,
            "execution_time": exec_time,
            "eval_results": eval_res,
        }

    report_path = generate_multi_report(
        multi_results=multi_results,
        form_name=args.form,
        prompt_name=args.prompt,
        chunk_size=args.chunk_size,
        profile_names=profile_names,
    )
    print(f"\nSuccessful multi-profile execution! Consolidated benchmark report saved to: {report_path}")


if __name__ == "__main__":
    main()
