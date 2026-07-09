from unittest.mock import Mock


def validate_fields_success_response(
    validated_fields: dict | None = None,
    profile_sync: dict | None = None,
) -> Mock:
    response = Mock()
    response.status_code = 200
    response.json.return_value = {
        "status": "success",
        "validated_fields": validated_fields or {},
        "profile_sync": profile_sync or {},
    }
    response.raise_for_status = Mock()
    return response


def validate_fields_error_response(errors: dict) -> Mock:
    response = Mock()
    response.status_code = 422
    response.json.return_value = {
        "status": "error",
        "validation_errors": errors,
    }
    return response
