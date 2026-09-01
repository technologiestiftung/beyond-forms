import numpy as np
from typing import Any, Callable, Coroutine
import asyncio
import json
import logging
from pathlib import Path

from litellm import aembedding

from app.document_classifier.system_prompts import (
    UNKNOWN_TYPE,
    UNKNOWN_LABEL,
)
from app.domain.classified_document import ClassifiedDocument
from beyondforms.document_schemas.document_registry import document_registry

logger = logging.getLogger(__name__)

Classifier = Callable[[str, str], Coroutine[Any, Any, ClassifiedDocument]]

FAILED_EXTRACTION = ClassifiedDocument(
    document_type=UNKNOWN_TYPE,
    system_label=UNKNOWN_LABEL,
)

doc_type_embeddings = {}


def get_cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


CACHE_DIR = Path(__file__).parent.parent.parent.parent / ".cache"
CACHE_FILE = CACHE_DIR / "embeddings.json"


async def load_doc_type_embeddings(model_name: str):
    logger.info("Loading document types and generating embeddings...")
    slugs = document_registry.list_keys()

    cached_embeddings = {}
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r") as f:
                cached_embeddings = json.load(f)
            logger.info(f"Loaded cached embeddings for {len(cached_embeddings)} types.")
        except Exception as e:
            logger.error(f"Error loading cache: {e}")

    missing_slugs = [slug for slug in slugs if slug not in cached_embeddings]

    if missing_slugs:
        logger.info(f"Fetching embeddings for {len(missing_slugs)} missing document types...")

        async def get_emb(slug):
            cls = document_registry.get_or_raise(slug)
            description = cls.model_fields["description"].default
            try:
                response = await aembedding(model=model_name, input=[description])
                emb = response["data"][0]["embedding"]
                logger.info(f"Embedded {slug}")
                return slug, emb
            except Exception as e:
                logger.error(f"Error embedding {slug}: {e}")
                return slug, None

        results = await asyncio.gather(*(get_emb(slug) for slug in missing_slugs))

        for slug, emb in results:
            if emb:
                cached_embeddings[slug] = emb

        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, "w") as f:
                json.dump(cached_embeddings, f)
            logger.info("Saved embeddings to cache.")
        except Exception as e:
            logger.error(f"Error saving cache: {e}")

    for slug, emb in cached_embeddings.items():
        doc_type_embeddings[slug] = emb

    logger.info("Startup complete.")


def init_document_classifier(model_name: str, candidate_counts: int) -> Classifier:
    async def document_classifier(base64_data: str, mime_type: str) -> ClassifiedDocument:
        data_uri = f"data:{mime_type};base64,{base64_data}"

        try:
            response = await aembedding(model=model_name, input=[data_uri])
            file_emb = response["data"][0]["embedding"]
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return FAILED_EXTRACTION

        best_match = None
        best_score = -1.0

        for slug, emb in doc_type_embeddings.items():
            score = get_cosine_similarity(file_emb, emb)
            if score > best_score:
                best_score = score
                best_match = slug

        return ClassifiedDocument(
            document_type=best_match or "unknown",
            system_label=best_match or "unknown",
        )

    return document_classifier
