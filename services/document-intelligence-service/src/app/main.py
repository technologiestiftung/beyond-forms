import base64
import json
import logging
import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from google.cloud import storage

from app.document_classifier.classifier import init_document_classifier
from beyondforms.document_schemas.document_registry import document_registry
from app.utils.web import api_response
from entity_extractor.extractor import init_entity_extractor
from app.entity_extractor.system_prompts import (
    ENTITY_EXTRACTION_PROMPT,
    generate_entity_extraction_prompt_tail,
)
from app.entity_extractor.extractor import (
    extract_generic_envelope_from_document,
    extract_data_from_document,
)
from beyondforms.document_schemas.validation import (
    filter_to_json_schema_properties,
    parse_document_fields,
)

load_dotenv("../../.env.local")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing DocumentService...")
    from app.document_classifier.classifier import load_doc_type_embeddings

    embedding_model = os.getenv("GEMINI_EMBEDDING_MODEL_NAME", "vertex_ai/gemini-embedding-2-preview")
    await load_doc_type_embeddings(embedding_model)

    # Cache HTML template
    template_path = Path(__file__).parent / "templates" / "self_test.html"
    try:
        with open(template_path, "r") as f:
            app.state.self_test_html = f.read()
    except FileNotFoundError:
        app.state.self_test_html = "<h1>Template not found</h1>"

    # Initialize processors
    model_name = os.getenv("GEMINI_MODEL_NAME", "gemini-3.7-flash")
    app.state.classify_document = init_document_classifier(model_name=embedding_model, candidate_counts=3)
    app.state.extract_entities = init_entity_extractor(model_name=model_name, document_registry=document_registry)

    logger.info("DocumentService initialized.")
    yield
    # Shutdown
    logger.info("Shutting down Document Intelligence Service...")


app = FastAPI(
    title="Document Intelligence Service",
    version="0.2.0",
    description="Automated document classification and extraction for BeyondForms",
    lifespan=lifespan,
)

logger.info(f"Registry initialized with {len(document_registry.list_keys())} documents.")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://beyond-forms-frontend.web.app",
        "http://localhost:5173",
        "http://localhost:8080",
        "https://staging.bf.citylab-berlin.org",
        "https://prod.bf.citylab-berlin.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Global Exception Handlers ---
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc):
    return api_response(status_str="error", code=exc.status_code, detail=exc.detail)


@app.exception_handler(Exception)
async def universal_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return api_response(status_str="error", code=500, detail="Internal Server Error")


@app.exception_handler(415)
async def unsupported_media_type_handler(request, exc):
    return api_response(
        status_str="error",
        code=415,
        content={"detail": "Unsupported Media Type. Allowed types: application/pdf, image/png, image/jpeg"},
    )


@app.exception_handler(404)
async def not_found_handler(request, exc):
    return api_response(status_str="error", code=404, detail="The requested resource was not found.")


@app.exception_handler(422)
async def unprocessable_entity_handler(request, exc):
    logger.error(f"Unprocessable Entity: {str(exc)}", exc_info=True)
    return api_response(
        status_code=422,
        content={"detail": "The request could not be processed. Please check the input and try again."},
    )


# --- Routes ---
@app.get("/")
async def root():
    return {
        "message": "BeyondForms Document Intelligence Service is running",
        "version": "0.2.0",
    }


@app.get("/health")
async def health():
    return api_response(status_str="success", code=200)


@app.get("/self-test", response_class=HTMLResponse)
async def self_test():
    if hasattr(app.state, "self_test_html"):
        return HTMLResponse(content=app.state.self_test_html)
    return HTMLResponse(content="<h1>Template not found</h1>", status_code=404)


@app.get("/get-available-document-types")
async def get_available_document_types():
    return api_response("available-forms", document_registry.list_keys())


@app.get("/get-document-type-definition/{document_type_name}")
async def get_document_type_definition(document_type_name: str):
    document_type_definition = document_registry.get_or_raise(document_type_name)
    return api_response("document-type-definition", document_type_definition.model_json_schema())


def _resolve_file_bytes(file: Optional[UploadFile], gcs_uri: Optional[str]) -> tuple[bytes, str]:
    if gcs_uri and file:
        raise HTTPException(status_code=400, detail="Provide either 'file' or 'gcs_uri', not both")
    if gcs_uri:
        if not gcs_uri.startswith("gs://"):
            raise HTTPException(status_code=400, detail="gcs_uri must start with gs://")
        parts = gcs_uri[5:].split("/", 1)
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid GCS URI format")
        bucket_name, object_name = parts
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        return blob.download_as_bytes(), os.path.basename(object_name)
    if file:
        return file.file.read(), os.path.basename(file.filename or "")
    raise HTTPException(status_code=400, detail="Either 'file' or 'gcs_uri' is required")


@app.post("/classify")
async def classify(
    file: Optional[UploadFile] = File(None),
    gcs_uri: Annotated[Optional[str], Form()] = None,
    model_name: Annotated[Optional[str], Form(alias="model")] = None,
    enable_entity_extraction: Annotated[bool, Form(alias="entity-extraction")] = True,
    desired_output_structure: Annotated[Optional[str], Form(alias="desired-output-structure")] = None,
):
    if not file and not gcs_uri:
        return api_response(
            status_str="error",
            code=400,
            detail="Either 'file' or 'gcs_uri' is required",
        )

    try:
        file_bytes, safe_filename = _resolve_file_bytes(file, gcs_uri)
        base64_data = base64.b64encode(file_bytes).decode("utf-8")

        mime_type, _ = mimetypes.guess_type(safe_filename)
        if not mime_type:
            mime_type = "application/octet-stream"

        if not hasattr(app.state, "classify_document") or app.state.classify_document is None:
            embedding_model = model_name or os.getenv(
                "GEMINI_EMBEDDING_MODEL_NAME", "vertex_ai/gemini-embedding-2-preview"
            )
            app.state.classify_document = init_document_classifier(model_name=embedding_model, candidate_counts=3)
        if not hasattr(app.state, "extract_entities") or app.state.extract_entities is None:
            extract_model_name = model_name or os.getenv("GEMINI_MODEL_NAME", "gemini-3.7-flash")
            app.state.extract_entities = init_entity_extractor(
                model_name=extract_model_name, document_registry=document_registry
            )

        classified_document = await app.state.classify_document(base64_data, mime_type)

        return_values = {
            "filename": safe_filename,
            "content_type": mime_type,
            "classified_document": classified_document,
        }

        if enable_entity_extraction:
            if desired_output_structure:
                try:
                    schema_dict = json.loads(desired_output_structure)
                except json.JSONDecodeError:
                    return api_response(
                        status_str="error",
                        code=400,
                        detail="Invalid dynamic structure schema provided",
                    )

                from app.entity_extractor.extractor import extract_data_from_document

                extraction_res = await extract_data_from_document(
                    base64_data=base64_data,
                    mime_type=mime_type,
                    schema_dict=schema_dict,
                    model_name=extract_model_name,
                )

                raw_extraction = extraction_res.get("extracted_data", {})
                if isinstance(raw_extraction, dict):
                    return_values["extraction_result"] = filter_to_json_schema_properties(raw_extraction, schema_dict)
                else:
                    return_values["extraction_result"] = {}
            else:
                extracted_data = await app.state.extract_entities(classified_document, base64_data, mime_type)

                if isinstance(extracted_data, dict):
                    return_values["extraction_result"] = extracted_data
                elif hasattr(extracted_data, "model_dump"):
                    return_values["extraction_result"] = extracted_data.model_dump(
                        exclude={"description"}, exclude_none=True
                    )
                else:
                    return_values["extraction_result"] = extracted_data

        return api_response(data=return_values)

    except Exception as exception:
        logger.error(f"Classification failed: {exception}", exc_info=True)
        return api_response(status_str="error", code=500, detail="Internal Server Error")


@app.post("/api/v1/stateless/extract")
async def stateless_extract(
    file: Optional[UploadFile] = File(None),
    gcs_uri: Annotated[Optional[str], Form()] = None,
    schema: Optional[str] = Form(None),
    document_type: Optional[str] = Form(None),
    model_name: Annotated[str, Form(alias="model")] = None,
    wrap_metadata: Annotated[bool, Form(alias="wrap-metadata")] = False,
):
    if not file and not gcs_uri:
        return api_response(
            status_str="error",
            code=400,
            detail="Either 'file' or 'gcs_uri' is required",
        )

    if not schema and not document_type:
        return api_response(
            status_str="error",
            code=400,
            detail="Either 'schema' or 'document_type' is required",
        )

    if schema and document_type:
        return api_response(
            status_str="error",
            code=400,
            detail="Provide either 'schema' or 'document_type', not both",
        )

    doc_model = None
    if document_type:
        try:
            doc_model = document_registry.get_or_raise(document_type)
            schema_dict = doc_model.model_json_schema()
        except ValueError:
            return api_response(
                status_str="error",
                code=400,
                detail=f"Unknown document type: {document_type}",
            )
    else:
        try:
            schema_dict = json.loads(schema)
        except json.JSONDecodeError:
            return api_response(status_str="error", code=400, detail="Invalid JSON schema provided")

    try:
        file_bytes, safe_filename = _resolve_file_bytes(file, gcs_uri)
        base64_data = base64.b64encode(file_bytes).decode("utf-8")
        mime_type, _ = mimetypes.guess_type(safe_filename)
        if not mime_type:
            mime_type = "application/octet-stream"

        system_prompt = None
        if doc_model:
            system_prompt = ENTITY_EXTRACTION_PROMPT + generate_entity_extraction_prompt_tail(doc_model)

        if wrap_metadata:
            extraction_res = await extract_generic_envelope_from_document(
                base64_data=base64_data,
                mime_type=mime_type,
                schema_dict=schema_dict,
                model_name=model_name or os.getenv("GEMINI_MODEL_NAME", "gemini-3.7-flash"),
            )
            return api_response(data=extraction_res)
        else:
            extraction_res = await extract_data_from_document(
                base64_data=base64_data,
                mime_type=mime_type,
                schema_dict=schema_dict,
                model_name=model_name or os.getenv("GEMINI_MODEL_NAME", "gemini-3.7-flash"),
                system_prompt_prefix=system_prompt,
            )

            result_data = extraction_res.get("extracted_data", {})
            logger.info(f"Raw extracted data keys: {list(result_data.keys()) if isinstance(result_data, dict) else []}")

            if isinstance(result_data, dict):
                if doc_model:
                    result_data = parse_document_fields(doc_model, result_data)
                else:
                    result_data = filter_to_json_schema_properties(result_data, schema_dict)
                logger.info(f"Post-filter keys: {list(result_data.keys())}")

            return api_response(data={"extracted_data": result_data})

    except Exception as exception:
        logger.error(f"Stateless extraction failed: {exception}", exc_info=True)
        return api_response(status_str="error", code=500, detail="Internal Server Error")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
