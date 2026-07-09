import pytest
from pydantic import Field, ValidationError
from decimal import Decimal
from datetime import date
from typing import Optional

from beyondforms.document_schemas.document_registry import (
    DocumentRegistry,
    BaseDocument,
)


# --- Mock Document Definitions for Testing ---


class MockFinancialForm(BaseDocument):
    """A stable mock for testing decimal and boolean logic."""

    description: str = "A mock form for financial testing."
    amount: Decimal = Field(description="Total amount.")
    is_approved: bool = Field(default=False, description="Approval status.")


class MockIdentityForm(BaseDocument):
    """A stable mock for testing date and string logic."""

    description: str = "A mock form for identity testing."
    full_name: str = Field(description="Full name of the individual.")
    expiry_date: Optional[date] = Field(None, description="Expiration date.")


# --- Tests ---


@pytest.fixture
def registry():
    """Provides a fresh, empty registry for every test to ensure isolation."""
    return DocumentRegistry()


def test_registration_and_retrieval(registry):
    """
    Ensure the registry correctly stores and retrieves a document class by its slug.
    """
    registry.register("mock_financial", MockFinancialForm)

    retrieved_class = registry.get_or_raise("mock_financial")

    assert retrieved_class == MockFinancialForm
    assert "mock_financial" in registry.list_keys()
    assert len(registry.list_keys()) == 1


def test_registry_raises_value_error_on_missing_slug(registry):
    """
    Verify that an unregistered slug triggers a descriptive ValueError.
    """
    with pytest.raises(ValueError, match="Document type 'ghost_form' not found."):
        registry.get_or_raise("ghost_form")


def test_mock_financial_validation_logic():
    """
    Verify that the registry-compatible models enforce data types correctly.
    This ensures our 'BaseDocument' inheritance doesn't break Pydantic behavior.
    """
    # Test valid instantiation
    data = {
        "description": "Custom override",
        "amount": "150.75",  # Pydantic coerces string to Decimal
        "is_approved": True,
    }
    instance = MockFinancialForm(**data)
    assert instance.amount == Decimal("150.75")
    assert instance.is_approved is True

    # Test invalid data type
    with pytest.raises(ValidationError):
        MockFinancialForm(amount="not-a-number", description="error test")


def test_mock_identity_date_handling():
    """
    Ensure the models handle ISO date strings correctly, as this is what
    the LLM will typically return in JSON.
    """
    valid_iso_date = "2026-12-31"
    instance = MockIdentityForm(description="ID Test", full_name="Jane Doe", expiry_date=valid_iso_date)

    assert isinstance(instance.expiry_date, date)
    assert instance.expiry_date.year == 2026


def test_registry_list_keys_is_complete(registry):
    """
    Ensure the list of keys stays in sync with multiple registrations.
    """
    registry.register("form_a", MockFinancialForm)
    registry.register("form_b", MockIdentityForm)

    keys = registry.list_keys()
    assert "form_a" in keys
    assert "form_b" in keys
    assert len(keys) == 2
