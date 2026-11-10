import logging
import uvicorn
from fastapi import FastAPI, Body, Query, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError, TypeAdapter, BaseModel
from typing import Any, Optional


from app import domain
from app.domain.registry import form_registry, field_registry
from app.validation.verified_fields import validate_document_verified_fields, validate_profile_fields
from app.domain.decision_tree import DecisionTreeEvaluator
from app.validation.error_formatting import format_validation_errors

logger = logging.getLogger(__name__)

app = FastAPI(title="Rules-Engine")

logger.info(f"Registry initialized with {len(domain.field_registry._registry)} fields.")

class FormRequestBody(BaseModel):
    form_type: str
    form_content: dict


class FieldTypeRequest(BaseModel):
    field_type: str
    field_value: Any



# --- Global Exception Handlers ---
@app.exception_handler(Exception)
async def universal_exception_handler(request, exc):
    logger.exception("Unhandled Server Exception:")
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# --- Routes ---
@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/get-available-forms")
async def get_available_forms():
    return {"available-forms": form_registry.list_keys()}


@app.get("/get-form-definition/{form_name}")
async def get_form_definition(form_name: str):
    form_definition = form_registry.get_or_404(form_name)
    return {"form-definition": form_definition.model_json_schema()}


@app.get("/get-available-field-types")
async def get_available_field_types():
    return {"available-field-types": field_registry.list_keys()}


@app.get("/get-field-type-definition/{field_name}")
async def get_field_type_definition(field_name: str):
    field_type = field_registry.get_or_404(field_name)
    return {"field-definition": TypeAdapter(field_type).json_schema()}


def count_required_fields(model_class: type[BaseModel]) -> int:
    """Recursively count all required leaf fields in a Pydantic model."""
    count = 0
    for field_info in model_class.model_fields.values():
        field_type = field_info.annotation
        is_required = field_info.is_required()

        target_model = None
        if getattr(field_type, "__origin__", None) is not None:
            args = getattr(field_type, "__args__", ())
            for arg in args:
                if isinstance(arg, type) and issubclass(arg, BaseModel):
                    target_model = arg
                    break
        elif isinstance(field_type, type) and issubclass(field_type, BaseModel):
            target_model = field_type

        if target_model:
            if is_required:
                count += count_required_fields(target_model)
        elif is_required:
            count += 1
    return count


@app.post("/validate-form")
async def validate(
    request: FormRequestBody = Body(...),
    validate_entire_form: bool = Query(False, alias="validate_entire_form"),
):
    form_class = form_registry.get_or_404(request.form_type)

    total_required_fields = count_required_fields(form_class)

    try:
        validated_data = form_class.model_validate(request.form_content)
        return {
            "form_content": validated_data.model_dump(),
            "total_required_fields": total_required_fields,
            "missing_field_count": 0,
            "missing_fields": [],
            "is_submittable": True,
        }

    except ValidationError as e:
        all_errors = format_validation_errors(e.errors())
        missing_fields = [error["field_path"] for error in all_errors if error["type"] == "missing"]
        validation_errors = [error for error in all_errors if error["type"] != "missing"]

        resp_metadata = {
            "total_required_fields": total_required_fields,
            "missing_field_count": len(missing_fields),
            "missing_fields": missing_fields,
            "is_submittable": False,
        }

        if validate_entire_form:
            return JSONResponse(
                status_code=422,
                content={
                    "detail": "Validation failed.",
                    "validation_errors": all_errors,
                    **resp_metadata,
                },
            )

        if validation_errors:
            return JSONResponse(
                status_code=422,
                content={
                    "detail": "Validation failed.",
                    "validation_errors": validation_errors,
                    **resp_metadata,
                },
            )

        return {"validation_type": "partial", **resp_metadata}


class BatchValidationRequest(BaseModel):
    document_type: str | None = None
    fields: dict[str, Any]


@app.post("/validate-fields")
async def validate_fields(request: BatchValidationRequest = Body(...)):
    if request.document_type:
        try:
            validation_result = validate_document_verified_fields(request.document_type, request.fields)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown document type: {request.document_type}")

        if validation_result.errors:
            return JSONResponse(
                status_code=422,
                content={
                    "detail": "Validation failed",
                    "validation_errors": validation_result.errors,
                },
            )

        return {
            "validated_fields": validation_result.validated_fields,
            "profile_sync": validation_result.profile_sync,
        }

    validation_result = validate_profile_fields(request.fields)

    if validation_result.errors:
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Validation failed",
                "validation_errors": validation_result.errors,
            },
        )

    return {"validated_fields": validation_result.validated_fields}


@app.post("/validate-field")
async def validate_field(request: FieldTypeRequest = Body(...)):
    field_type = field_registry.get_or_404(request.field_type)

    try:
        validated_value = TypeAdapter(field_type).validate_python(request.field_value)
        return {"validated_value": validated_value}
    except ValidationError as e:
        return JSONResponse(
            status_code=422,
            content={
                "detail": f"Validation failed for type: {request.field_type}",
                "validation_errors": format_validation_errors(e.errors()),
            },
        )


class WizardEvaluationRequest(BaseModel):
    form_content: dict[str, Any]
    current_step_id: Optional[str] = None


@app.post("/wizard/evaluate")
async def evaluate_wizard(request: WizardEvaluationRequest = Body(...)):
    try:
        evaluator = DecisionTreeEvaluator()
        result = evaluator.evaluate(request.form_content, request.current_step_id)
        return {"evaluation": result}
    except Exception as e:
        logger.exception("Failed to evaluate wizard rules:")
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


if __name__ == "__main__":
    uvicorn.run(app, port=8080, host="0.0.0.0")
