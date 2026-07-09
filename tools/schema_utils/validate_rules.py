import argparse
import json
import jsonschema
import sys
from pathlib import Path

from json_io import load_json


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_RULES_PATH = PROJECT_ROOT / "schemas" / "rules" / "basic-welfare-rules.jsonc"


def validate(rules_path: Path, schema_path: Path) -> None:
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    rules = load_json(rules_path)

    jsonschema.validate(instance=rules, schema=schema)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a wizard rules JSON file against the schema.")
    parser.add_argument(
        "--rules",
        "-r",
        type=Path,
        default=DEFAULT_RULES_PATH,
        help="Path to the rules JSON file to validate",
    )
    parser.add_argument(
        "--schema",
        "-s",
        type=Path,
        default=PROJECT_ROOT / "schemas" / "rules" / "wizard-rules.schema.json",
        help="Path to the JSON schema file",
    )
    args = parser.parse_args()

    try:
        validate(args.rules, args.schema)
        print(f"Validation successful! {args.rules} matches the Wizard Rules Schema.")
        return 0
    except jsonschema.exceptions.ValidationError as e:
        print("Validation failed!")
        print(f"Error message: {e.message}")
        print(f"Path: {list(e.path)}")
        return 1
    except FileNotFoundError as e:
        print(f"File not found: {e.filename}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
