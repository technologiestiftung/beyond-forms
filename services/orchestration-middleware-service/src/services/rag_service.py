import logging
import os

from litellm.vector_stores.main import asearch

logger = logging.getLogger(__name__)

GEMINI_PROVIDER = "vertex_ai"


def _resolve_store_id() -> tuple[str, str, str]:
    corpus_id = os.getenv("RAG_ENGINE_CORPUS")
    if not corpus_id:
        raise ValueError("RAG_ENGINE_CORPUS must be set")

    project = os.getenv("GCLOUD_PROJECT")
    if not project:
        raise ValueError("GCLOUD_PROJECT must be set")

    location = os.getenv("GCP_RAG_ENGINE_REGION")
    if not location:
        raise ValueError("GCP_RAG_ENGINE_REGION must be set")

    store_id = f"projects/{project}/locations/{location}/ragCorpora/{corpus_id}"
    return store_id, project, location


async def search_knowledge_base(question: str, max_results: int = 5) -> str:
    store_info = _resolve_store_id()
    if not store_info:
        return "Knowledge base not configured."

    store_id, project, location = store_info

    response = await asearch(
        vector_store_id=store_id,
        query=question,
        custom_llm_provider=GEMINI_PROVIDER,
        max_num_results=max_results,
        vertex_project=project,
        vertex_location=location,
    )

    if not response:
        return "No relevant information found."

    data = response.get("data", []) if isinstance(response, dict) else getattr(response, "data", [])
    if not data:
        return "No relevant information found."

    chunks = []
    for item in data:
        content_list = item.get("content", []) if isinstance(item, dict) else getattr(item, "content", [])
        if not content_list:
            continue
        for content in content_list:
            text = content.get("text") if isinstance(content, dict) else getattr(content, "text", None)
            if text:
                chunks.append(str(text))

    return "\n\n---\n\n".join(chunks) if chunks else "No relevant information found."
