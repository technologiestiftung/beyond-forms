from starlette.responses import JSONResponse
from app.utils.web import api_response


def test_api_response_success_defaults():
    """
    Verify the default 'success' envelope when only a message is provided.
    """
    response = api_response(data_key="message", data_value="Operation successful")

    assert isinstance(response, JSONResponse)
    assert response.status_code == 200

    # Parse the content (Starlette stores it as bytes)
    import json

    content = json.loads(response.body)

    assert content["status"] == "success"
    assert content["code"] == 200
    assert content["message"] == "Operation successful"


def test_api_response_with_custom_error():
    """
    Verify the envelope structure for error states with custom HTTP codes.
    """
    error_detail = "Invalid file format provided."
    response = api_response(status_str="error", code=415, detail=error_detail)

    import json

    content = json.loads(response.body)

    assert response.status_code == 415
    assert content["status"] == "error"
    assert content["code"] == 415
    assert content["detail"] == error_detail


def test_api_response_merges_kwargs():
    """
    Ensure that extra keyword arguments are correctly flattened into the top-level JSON.
    """
    response = api_response(
        data_key="payload",
        data_value={"id": 123},
        extra_info="debug_mode",
        request_id="abc-987",
    )

    import json

    content = json.loads(response.body)

    assert content["payload"] == {"id": 123}
    assert content["extra_info"] == "debug_mode"
    assert content["request_id"] == "abc-987"


def test_api_response_serialization_with_complex_types():
    """
    Verify that the response utility correctly serializes complex types
    (like lists or nested dicts) using jsonable_encoder.
    """
    complex_data = [{"id": 1, "tags": ["test", "mock"]}, {"id": 2}]
    response = api_response(data_key="items", data_value=complex_data)

    import json

    content = json.loads(response.body)

    assert content["items"] == complex_data
    assert isinstance(content["items"], list)
    assert content["items"][0]["tags"][1] == "mock"


def test_api_response_no_data_key():
    """
    Ensure the utility still functions correctly even if no data key or value is passed.
    """
    response = api_response(status_str="ok", code=204)

    import json

    content = json.loads(response.body)

    assert content["status"] == "ok"
    assert "data_key" not in content
