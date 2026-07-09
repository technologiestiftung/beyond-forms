import string
from typing import Tuple, Dict

from beyondforms.document_schemas.document_registry import document_registry

_LABELS = string.ascii_letters  # A-Z, a-z


def get_label_mappings() -> Tuple[Dict[str, str], Dict[str, str]]:
    """Generates bidirectional mappings between single-character labels and document slugs."""
    label_to_slug = {}
    slug_to_label = {}

    for index, slug in enumerate(document_registry.list_keys()):
        if index >= len(_LABELS):
            break
        label = _LABELS[index]
        label_to_slug[label] = slug
        slug_to_label[slug] = label

    return label_to_slug, slug_to_label
