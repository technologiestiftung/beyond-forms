from typing import Type, Dict
from pydantic import BaseModel, ConfigDict


class DocumentRegistry:
    def __init__(self) -> None:
        self._registry: Dict[str, Type[BaseModel]] = {}

    def register(self, slug: str, document_class: Type[BaseModel]) -> Type[BaseModel]:
        self._registry[slug] = document_class
        return document_class

    def get_or_raise(self, slug: str) -> Type[BaseModel]:
        if slug not in self._registry:
            raise ValueError(f"Document type '{slug}' not found.")
        return self._registry[slug]

    def list_keys(self):
        return list(self._registry.keys())


document_registry = DocumentRegistry()


def register_document(slug: str):
    def wrapper(document_class: Type[BaseModel]) -> Type[BaseModel]:
        return document_registry.register(slug, document_class)

    return wrapper


class BaseDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str


from . import document_types as _document_types  # noqa: E402, F401
