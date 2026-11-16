from app.domain.registry import field_registry, form_registry

# need to import the modules that contain the @register_form decorators
# and field_registry.register() calls. This triggers the registration.
from app.domain import field_types  # noqa: F401
from app.domain import global_enums  # noqa: F401
from app.domain import forms  # noqa: F401

# Optionally expose them for easier access elsewhere
__all__ = ["field_registry", "form_registry"]
