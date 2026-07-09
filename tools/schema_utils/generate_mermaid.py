import argparse
import sys
from pathlib import Path

from json_io import load_json
from validate_rules import DEFAULT_RULES_PATH, validate


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def sanitize_id(step_id: str) -> str:
    return step_id.replace("-", "_").replace(" ", "_")


def escape_label(label: str) -> str:
    return label.replace('"', "#quot;")


def generate_mermaid(rules_path: Path, output_path: Path) -> None:
    rules = load_json(rules_path)

    lines = ["flowchart TD"]

    sections = rules.get("sections", [])
    steps = rules.get("steps", {})

    section_map = {}
    for section in sections:
        section_id = sanitize_id(section["id"])
        for step_id in section.get("steps", []):
            section_map[step_id] = section_id

    for step_id, step in steps.items():
        node_id = sanitize_id(step_id)
        title = escape_label(step.get("title", step_id))
        lines.append(f'    {node_id}["{title}"]')

    for step_id, step in steps.items():
        node_id = sanitize_id(step_id)
        for transition in step.get("transitions", []):
            next_step = transition.get("next_step", "END")
            condition = transition.get("condition")
            target_id = sanitize_id(next_step)

            if condition:
                cond_label = escape_label(condition)
                lines.append(f'    {node_id} -- "{cond_label}" --> {target_id}')
            else:
                lines.append(f"    {node_id} --> {target_id}")

    for section in sections:
        section_id = sanitize_id(section["id"])
        section_title = escape_label(section.get("title", section["id"]))
        section_steps = section.get("steps", [])
        if not section_steps:
            continue

        lines.append(f'    subgraph {section_id}["{section_title}"]')
        for step_id in section_steps:
            if step_id in steps:
                lines.append(f"        {sanitize_id(step_id)}")
        lines.append("    end")

    mermaid_body = "\n".join(lines) + "\n"
    mermaid_text = f"```mermaid\n{mermaid_body}```\n"
    output_path.write_text(mermaid_text, encoding="utf-8")
    print(f"Mermaid diagram written to {output_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate wizard rules and generate a Mermaid diagram.")
    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        default=DEFAULT_RULES_PATH,
        help="Path to the rules JSON file",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=PROJECT_ROOT / "schemas" / "rules" / "basic-welfare-rules.md",
        help="Path to the output Markdown file",
    )
    parser.add_argument(
        "--schema",
        "-s",
        type=Path,
        default=PROJECT_ROOT / "schemas" / "rules" / "wizard-rules.schema.json",
        help="Path to the JSON schema file",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Skip schema validation before generating the diagram",
    )
    args = parser.parse_args()

    if not args.skip_validation:
        try:
            validate(args.input, args.schema)
            print("Validation passed.")
        except Exception as e:
            print(f"Validation failed: {e}")
            return 1

    try:
        generate_mermaid(args.input, args.output)
        return 0
    except Exception as e:
        print(f"Diagram generation failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
