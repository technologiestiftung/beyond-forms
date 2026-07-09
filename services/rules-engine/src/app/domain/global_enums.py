from enum import Enum
from typing import Annotated
from pydantic import BeforeValidator
from app.validators.ocr_preprocessors import normalize_nationality_string, normalize_gender_string


# ToDo: probably better move these to a DB instead of hard coding here!
class CountryCode(str, Enum):
    UNITED_STATES = "US"
    GERMANY = "DE"
    FRANCE = "FR"
    UNITED_KINGDOM = "GB"
    AUSTRIA = "AT"
    SWITZERLAND = "CH"
    POLAND = "PL"
    CZECH_REPUBLIC = "CZ"
    NETHERLANDS = "NL"
    UKRAINE = "UA"
    TURKEY = "TR"
    CANADA = "CA"
    SPAIN = "ES"
    ITALY = "IT"


CoercedCountry = Annotated[CountryCode, BeforeValidator(normalize_nationality_string)]


class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    NON_BINARY = "NON_BINARY"


CoercedGender = Annotated[Gender, BeforeValidator(normalize_gender_string)]


class MaritalStatus(str, Enum):
    SINGLE = "single"
    DIVORCED = "single"
    MARRIED = "married"
    PARTNERSHIP = "married"
    WIDOWED = "widowed"


class HouseholdMember(str, Enum):
    PARTNER = "partner"
    CHILD = "child"
    PARENT = "parent"
    ROOMMATE = "roommate"
    OTHER = "other"


class AccommodationType(str, Enum):
    RENTAL = "rental"
    HOME_OWNER = "home_owner"
    FLAT_OWNER = "flat_owner"
    CARE_HOME = "care_home_or_assisted_living_facility"


class DisplacedStatus(str, Enum):
    EXPELLEE_RESETTLER = "expellee_resettler"
    DISPLACED_PERSON_RESETTLER = "displaced_person_resettler"
    LATE_RESETTLER = "late_resettler"
    SPOUSE_OR_DESCENDANT_OF_LATE_RESETTLER = "spouse_or_descendant_of_late_resettler"
    SOVIET_ZONE_REFUGEE = "soviet_zone_refugee"


class HealthInsuranceStatus(str, Enum):
    COMPULSORY_INSURANCE = "compulsory_insurance"
    VOLUNTARY_INSURANCE = "voluntary_insurance"
    FAMILY_INSURANCE = "family_insurance"
    PRIVATE_INSURANCE = "private_insurance"
    CARE_BY_HEALTH_INSURANCE_UNDER_264_SGB_V = "care_by_health_insurance_under_264_sgb_v"


class IncomeType(str, Enum):
    GOVERNMENT_PENSION = "government_pension"
    SURVIVORS_PENSION = "survivors_pension"
    EMPLOYED = "employed"
    HOUSING_BENEFIT = "housing_benefit"
    ALIMONY = "alimony"
    NOTHING = "nothing"


class AssetType(str, Enum):
    SAVINGS = "savings"
    CAR = "car"
    LIFE_INSURANCE = "life_insurance"


class SocialSecurityStatus(str, Enum):
    NONE = "none"
    PENSION_INSURANCE = "pension_insurance"
    LONG_TERM_CARE_INSURANCE = "long_term_care_insurance"


class HeatingType(str, Enum):
    STOVE_HEATING = "stove_heating"
    GAS_HEATING = "gas_heating"
