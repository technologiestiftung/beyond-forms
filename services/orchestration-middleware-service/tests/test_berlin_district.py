from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from src.services.berlin_districts import resolve_berlin_district


@pytest.fixture
def db():
    return MagicMock(spec=Session)


def _mock_address_lookup(mock_db: MagicMock, bez_name: str) -> None:
    mock_db.query.return_value.filter.return_value.limit.return_value.scalar.return_value = bez_name


def test_single_zip_code_returns_district(db):
    assert resolve_berlin_district(db=db, zip_code="10115") == "Mitte"
    assert resolve_berlin_district(db=db, zip_code="12049") == "Neukölln"


def test_unknown_zip_code_returns_none(db):
    assert resolve_berlin_district(db=db, zip_code="99999") is None


def test_ambiguous_zip_code_without_address_returns_none(db):
    assert resolve_berlin_district(db=db, zip_code="10119") is None


def test_ambiguous_zip_code_uses_local_address_lookup_when_address_present(db):
    _mock_address_lookup(db, "Pankow")
    result = resolve_berlin_district(
        db=db,
        street="Schönhauser Allee",
        house_number="1",
        zip_code="10119",
    )

    assert result == "Pankow"


def test_ambiguous_zip_code_uses_local_address_lookup_for_known_building(db):
    _mock_address_lookup(db, "Friedrichshain-Kreuzberg")
    result = resolve_berlin_district(
        db=db,
        street="Niederkirchnerstraße",
        house_number="7",
        zip_code="10963",
    )

    assert result == "Friedrichshain-Kreuzberg"


def test_resolve_berlin_district_database_exception_resilience(db):
    # Mock database to throw an exception on query
    db.query.side_effect = Exception("Database connection failure or missing table")

    result = resolve_berlin_district(
        db=db,
        street="Schönhauser Allee",
        house_number="1",
        zip_code="10119",
    )
    # The database lookup exception should be caught, and return None
    assert result is None
