from typing import Any, List, Dict

from pydantic_core import ErrorDetails


def format_validation_errors(errors: List[ErrorDetails]) -> List[Dict[str, Any]]:
    """Standardizes Pydantic error formatting."""
    return [
        {
            "field_path": " -> ".join(map(str, error["loc"])),
            "message": error["msg"],
            "type": error["type"],
            "input_provided": error.get("input"),
        }
        for error in errors
    ]
