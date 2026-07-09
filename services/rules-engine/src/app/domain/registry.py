from typing import Any, Dict, Type, TypeVar, Generic
from pydantic import BaseModel
from fastapi import HTTPException, status

T = TypeVar("T")


class BaseRegistry(Generic[T]):
    """Generic registry to handle lookups and registration."""

    def __init__(self, name: str):
        self.name = name
        self._registry: Dict[str, T] = {}

    def register(self, identifier: str, item: T) -> T:
        self._registry[identifier] = item
        return item

    def get(self, identifier: str) -> T:
        item = self._registry.get(identifier)
        if not item:
            available = ", ".join(self._registry.keys())
            raise ValueError(f"{self.name} '{identifier}' not found. Available: {available}")
        return item

    def get_or_404(self, key: str) -> T:
        """Fetch from registry or raise a FastAPI 404 immediately."""
        item = self._registry.get(key)
        if not item:
            # use the registry's name (e.g., "Form definition") for the error
            available = ", ".join(self._registry.keys())
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name} '{key}' not found. Available: {available}",
            )
        return item

    def list_keys(self):
        return list(self._registry.keys())


field_registry = BaseRegistry[Any]("Field Type")
form_registry = BaseRegistry[Type[BaseModel]]("Form")


def register_form(slug: str):
    """Decorator that registers a model as a Form AND a Field Type."""

    def wrapper(model_class: Type[BaseModel]):
        form_registry.register(slug, model_class)
        # make form a usable field type for nested dynamic forms
        field_registry.register(slug, model_class)
        return model_class

    return wrapper
