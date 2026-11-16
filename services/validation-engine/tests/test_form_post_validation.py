import pytest
from enum import Enum
from pydantic import BaseModel, model_validator, ValidationError


# --- Mocks definitions for testing ---
class IncomeType(str, Enum):
    SALARY = "salary"
    PENSION = "pension"


class AssetType(str, Enum):
    REAL_ESTATE = "real_estate"
    SAVINGS = "savings"


class MonetaryInformation(BaseModel):
    applicant_monthly_income_type: set[IncomeType]
    does_applicant_have_any_savings_properties_or_items_of_high_value: bool
    applicant_assets_type: set[AssetType]

    @model_validator(mode="after")
    def validate_declared_assets(self) -> "MonetaryInformation":
        if self.does_applicant_have_any_savings_properties_or_items_of_high_value and not self.applicant_assets_type:
            # We use ValueError so Pydantic handles the ValidationError construction
            raise ValueError("Applicant declared to have savings but did not specify any assets.")
        return self


# --- Test Cases ---


def test_validation_success_with_assets():
    """Should pass when savings are declared and assets are provided."""
    data = {
        "applicant_monthly_income_type": ["salary"],
        "does_applicant_have_any_savings_properties_or_items_of_high_value": True,
        "applicant_assets_type": ["savings"],
    }
    model = MonetaryInformation(**data)
    assert model.does_applicant_have_any_savings_properties_or_items_of_high_value is True
    assert len(model.applicant_assets_type) == 1


def test_validation_success_no_savings_no_assets():
    """Should pass when no savings are declared and asset list is empty."""
    data = {
        "applicant_monthly_income_type": ["pension"],
        "does_applicant_have_any_savings_properties_or_items_of_high_value": False,
        "applicant_assets_type": [],
    }
    model = MonetaryInformation(**data)
    assert not model.applicant_assets_type


def test_validation_fails_declared_savings_but_empty_assets():
    """Should raise ValidationError when savings is True but assets list is empty."""
    data = {
        "applicant_monthly_income_type": ["salary"],
        "does_applicant_have_any_savings_properties_or_items_of_high_value": True,
        "applicant_assets_type": [],
    }

    with pytest.raises(ValidationError) as excinfo:
        MonetaryInformation(**data)

    # Verify the custom error message is inside the Pydantic error list
    errors = excinfo.value.errors()
    assert len(errors) > 0
    assert "Applicant declared to have savings but did not specify any assets." in errors[0]["msg"]


def test_validation_deduplicates_sets():
    """Verify that passing duplicate items in JSON results in a unique set."""
    data = {
        "applicant_monthly_income_type": ["salary", "salary"],
        "does_applicant_have_any_savings_properties_or_items_of_high_value": False,
        "applicant_assets_type": [],
    }
    model = MonetaryInformation(**data)
    assert len(model.applicant_monthly_income_type) == 1
