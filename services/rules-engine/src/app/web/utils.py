from typing import Optional, Any, List, Dict

from fastapi.encoders import jsonable_encoder
from pydantic_core import ErrorDetails

from starlette.responses import JSONResponse


def api_response(
    data_key: Optional[str] = None,
    data_value: Any = None,
    status_str: str = "success",
    code: int = 200,
    **kwargs,
) -> JSONResponse:
    """Standardizes the JSON envelope for all responses."""
    content = {"status": status_str, "code": code}
    if data_key:
        content[data_key] = data_value
    content.update(kwargs)
    return JSONResponse(status_code=code, content=jsonable_encoder(content))


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
