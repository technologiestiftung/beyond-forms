import os
import re
import json
import logging
from pathlib import Path

import json5

logger = logging.getLogger(__name__)

_RULES_CACHE = {}


def parse_jsonc(content: str) -> dict:
    return json5.loads(content)


def load_rules_from_path(rules_path: Path) -> dict:
    path_str = str(rules_path.resolve())
    if path_str not in _RULES_CACHE:
        content = rules_path.read_text(encoding="utf-8")
        if rules_path.suffix.lower() in (".jsonc", ".json5"):
            _RULES_CACHE[path_str] = parse_jsonc(content)
        else:
            _RULES_CACHE[path_str] = json.loads(content)
    return _RULES_CACHE[path_str]


def resolve_path(data: dict, path: str):
    if not path or data is None:
        return None
    # Normalize brackets: e.g., a['b']['c'] -> a.b.c
    normalized = path.replace("['", ".").replace("']", "").replace("[", ".").replace("]", "")
    parts = normalized.split(".")
    curr = data
    for part in parts:
        if not part:
            continue
        if isinstance(curr, dict) and part in curr:
            curr = curr[part]
        elif isinstance(curr, list) and part.isdigit():
            idx = int(part)
            if 0 <= idx < len(curr):
                curr = curr[idx]
            else:
                return None
        else:
            return None
    return curr


def is_field_required(field_path: str, form_data: dict) -> bool:
    if not field_path:
        return False
    if field_path.endswith(".birth_name"):
        return False
    if field_path.endswith(".applicant_last_resided_address"):
        res_addr = resolve_path(form_data, "applicant_information.applicant_residence_address") or resolve_path(
            form_data, "applicant_infromation.applicant_residence_address"
        )
        return res_addr == "ohne feste Adresse"
    if field_path.endswith(".is_eu_citizen_5y") or field_path.endswith(".has_residence_permit"):
        citizenship = resolve_path(form_data, "applicant_information.applicant_personal_details.citizenship")
        return citizenship != "deutsch"
    return True


def evaluate_condition(data: dict, condition: str) -> bool:
    if not condition:
        return True

    condition = condition.strip()

    # 1. Check for exists check: $exists(path)
    if condition.startswith("$exists(") and condition.endswith(")"):
        path = condition[len("$exists(") : -1].strip()
        val = resolve_path(data, path)
        return val is not None

    # 2. Check for comparison operators (fixed order: match compound/longer operators first)
    operators = ["!=", "<=", ">=", "=", "<", ">"]
    for op in operators:
        if op in condition:
            left_expr, right_expr = condition.split(op, 1)
            left_val = resolve_path(data, left_expr.strip())
            right_val_str = right_expr.strip()

            # Parse right side constants
            if right_val_str == "true":
                right_val = True
            elif right_val_str == "false":
                right_val = False
            elif right_val_str == "null":
                right_val = None
            elif (right_val_str.startswith("'") and right_val_str.endswith("'")) or (
                right_val_str.startswith('"') and right_val_str.endswith('"')
            ):
                right_val = right_val_str[1:-1]
            else:
                try:
                    right_val = float(right_val_str)
                except ValueError:
                    right_val = right_val_str

            if op == "=":
                return left_val == right_val
            elif op == "!=":
                return left_val != right_val
            elif op == "<":
                return left_val < right_val if left_val is not None and right_val is not None else False
            elif op == ">":
                return left_val > right_val if left_val is not None and right_val is not None else False
            elif op == "<=":
                return left_val <= right_val if left_val is not None and right_val is not None else False
            elif op == ">=":
                return left_val >= right_val if left_val is not None and right_val is not None else False

    # Unknown expression: fallback to falsy
    logger.warning(f"Unknown condition syntax: {condition}")
    return False


class DecisionTreeEvaluator:
    def __init__(self, rules_path: Path = None):
        if not rules_path:
            # Fallback path lookup
            env_path = os.environ.get("WIZARD_RULES_PATH")
            if env_path:
                rules_path = Path(env_path)
            else:
                # Local dev fallback relative to this file
                project_root = Path(__file__).resolve().parents[5]
                rules_path = project_root / "schemas" / "rules" / "basic-welfare-rules.jsonc"
                if not rules_path.exists():
                    rules_path = project_root / "schemas" / "rules" / "basic-welfare-rules.json"

        self.rules_path = rules_path

    @property
    def rules(self) -> dict:
        if not self.rules_path or not self.rules_path.exists():
            raise FileNotFoundError(f"Rules schema file not found at: {self.rules_path}")
        return load_rules_from_path(self.rules_path)

    def evaluate(self, form_data: dict, current_step_id: str = None) -> dict:
        """
        Traverses the decision tree based on the provided form data.
        Returns:
            {
                "visited_steps": list[str],
                "next_step": str (or "END"),
                "required_documents": list[str],
                "missing_fields": list[str],
                "pending_step_id": str (the step we are blocked at)
            }
        """
        rules = self.rules
        steps = rules.get("steps", {})
        initial_step = rules.get("initial_step")

        visited_steps = []
        required_documents = set()
        missing_fields = set()

        curr_step_id = initial_step
        blocked_step = None

        while curr_step_id and curr_step_id != "END":
            if curr_step_id in visited_steps:
                logger.error(
                    f"Cycle detected in decision tree evaluator! Step '{curr_step_id}' was visited twice. Path: {visited_steps}"
                )
                blocked_step = curr_step_id
                break

            step = steps.get(curr_step_id)
            if not step:
                logger.error(f"Step '{curr_step_id}' not found in rules definitions.")
                break

            visited_steps.append(curr_step_id)

            # Check fields defined in the step.
            # If any of the fields is missing (i.e. resolve_path returns None), we flag them as missing
            step_missing_fields = []
            for field_path in step.get("fields", []):
                if not is_field_required(field_path, form_data):
                    continue
                val = resolve_path(form_data, field_path)
                if val is None:
                    missing_fields.add(field_path)
                    step_missing_fields.append(field_path)

            if step_missing_fields:
                blocked_step = curr_step_id
                break

            # Evaluate effects
            for effect in step.get("effects", []):
                eff_type = effect.get("type")
                eff_target = effect.get("target")
                eff_cond = effect.get("condition")

                is_met = True
                if eff_cond:
                    try:
                        is_met = evaluate_condition(form_data, eff_cond)
                    except Exception:
                        is_met = False

                if is_met and eff_type == "REQUIRE_DOCUMENT":
                    required_documents.add(eff_target)

            # Determine next transition
            next_step_id = None
            blocked_on_transition = False

            for transition in step.get("transitions", []):
                cond = transition.get("condition")
                target = transition.get("next_step", "END")

                if cond:
                    # Parse the paths referenced in the condition.
                    # Find words containing dots or brackets.
                    referenced_paths = re.findall(r"[a-zA-Z_][a-zA-Z0-9_\-\.\[\]\']*", cond)
                    keywords = {"true", "false", "null", "deutsch", "$exists", "and", "or", "not"}
                    paths = [p for p in referenced_paths if p not in keywords and ("." in p or "[" in p)]

                    is_any_path_missing = False
                    for path in paths:
                        if resolve_path(form_data, path) is None:
                            is_any_path_missing = True
                            break

                    if is_any_path_missing:
                        blocked_on_transition = True
                        break

                    try:
                        is_met = evaluate_condition(form_data, cond)
                        if is_met:
                            next_step_id = target
                            break
                    except Exception as e:
                        logger.warning(f"Error evaluating transition condition '{cond}': {e}")
                        blocked_on_transition = True
                        break
                else:
                    next_step_id = target
                    break

            if blocked_on_transition:
                blocked_step = curr_step_id
                break

            if not next_step_id:
                break

            curr_step_id = next_step_id

        return {
            "visited_steps": visited_steps,
            "next_step": curr_step_id,
            "required_documents": sorted(list(required_documents)),
            "missing_fields": sorted(list(missing_fields)),
            "pending_step_id": blocked_step,
        }
