"""Builders for A2UI v0.9 server-to-client messages, see https://a2ui.org."""

import uuid
from typing import Any

A2UI_VERSION = "v0.9"
KLARO_CATALOG_ID = "urn:beyond-forms:a2ui:catalog:klaro:v1"

Component = dict[str, Any]
Message = dict[str, Any]


def create_surface(surface_id: str) -> Message:
    return {"version": A2UI_VERSION, "createSurface": {"surfaceId": surface_id, "catalogId": KLARO_CATALOG_ID}}


def update_components(surface_id: str, components: list[Component]) -> Message:
    return {"version": A2UI_VERSION, "updateComponents": {"surfaceId": surface_id, "components": components}}


def new_surface(prefix: str, components: list[Component]) -> list[Message]:
    surface_id = f"{prefix}-{uuid.uuid4()}"
    return [create_surface(surface_id), update_components(surface_id, components)]


CONSENT_TEXTS = {
    "de": {
        "title": "Lass uns prüfen, welche Unterstützung zu Dir passt",
        "goal_label": "Ziel",
        "goal": "Eine erste Einschätzung, welche Leistungen für Dich infrage kommen.",
        "scope_label": "Umfang",
        "scope": "Etwa 10 kurze Fragen, ungefähr 3 Minuten. Du kannst zwischendurch jederzeit frei schreiben.",
        "privacy_label": "Deine Daten",
        "privacy": "Deine Antworten auf den Karten bleiben auf Deinem Gerät.",
        "start": "Los geht's",
        "later": "Später",
    },
    "en": {
        "title": "Let's find out which support fits you",
        "goal_label": "Goal",
        "goal": "A first assessment of which benefits may apply to you.",
        "scope_label": "Scope",
        "scope": "About 10 short questions, roughly 3 minutes. You can write freely at any point.",
        "privacy_label": "Your data",
        "privacy": "Your answers on the cards stay on your device.",
        "start": "Let's start",
        "later": "Later",
    },
}


def consent_surface(locale: str) -> list[Message]:
    texts = CONSENT_TEXTS.get(locale, CONSENT_TEXTS["de"])
    return new_surface(
        "eligibility-consent",
        [
            {"id": "root", "component": "Card", "child": "content"},
            {"id": "content", "component": "Column", "children": ["title", "goal", "scope", "privacy", "actions"]},
            {"id": "title", "component": "Text", "variant": "title", "text": texts["title"]},
            {"id": "goal", "component": "Fact", "label": texts["goal_label"], "text": texts["goal"]},
            {"id": "scope", "component": "Fact", "label": texts["scope_label"], "text": texts["scope"]},
            {"id": "privacy", "component": "Fact", "label": texts["privacy_label"], "text": texts["privacy"]},
            {"id": "actions", "component": "Row", "children": ["start", "later"]},
            {
                "id": "start",
                "component": "Chip",
                "variant": "solid",
                "label": texts["start"],
                "action": {"event": {"name": "start_check", "context": {}}},
            },
            {
                "id": "later",
                "component": "Chip",
                "label": texts["later"],
                "action": {"event": {"name": "decline_check", "context": {}}},
            },
        ],
    )
