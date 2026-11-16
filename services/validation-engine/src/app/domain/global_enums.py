from enum import StrEnum

class Gender(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    NON_BINARY = "NON_BINARY"

class MaritalStatus(StrEnum):
    SINGLE = "single"
    DIVORCED = "single"
    MARRIED = "married"
    PARTNERSHIP = "married"
    WIDOWED = "widowed"


class HouseholdMember(StrEnum):
    PARTNER = "partner"
    CHILD = "child"
    PARENT = "parent"
    ROOMMATE = "roommate"
    OTHER = "other"


class AccommodationType(StrEnum):
    RENTAL = "rental"
    HOME_OWNER = "home_owner"
    FLAT_OWNER = "flat_owner"
    CARE_HOME = "care_home_or_assisted_living_facility"


class DisplacedStatus(StrEnum):
    EXPELLEE_RESETTLER = "expellee_resettler"
    DISPLACED_PERSON_RESETTLER = "displaced_person_resettler"
    LATE_RESETTLER = "late_resettler"
    SPOUSE_OR_DESCENDANT_OF_LATE_RESETTLER = "spouse_or_descendant_of_late_resettler"
    SOVIET_ZONE_REFUGEE = "soviet_zone_refugee"


class HealthInsuranceStatus(StrEnum):
    COMPULSORY_INSURANCE = "compulsory_insurance"
    VOLUNTARY_INSURANCE = "voluntary_insurance"
    FAMILY_INSURANCE = "family_insurance"
    PRIVATE_INSURANCE = "private_insurance"
    CARE_BY_HEALTH_INSURANCE_UNDER_264_SGB_V = "care_by_health_insurance_under_264_sgb_v"


class IncomeType(StrEnum):
    GOVERNMENT_PENSION = "government_pension"
    SURVIVORS_PENSION = "survivors_pension"
    EMPLOYED = "employed"
    HOUSING_BENEFIT = "housing_benefit"
    ALIMONY = "alimony"
    NOTHING = "nothing"


class AssetType(StrEnum):
    SAVINGS = "savings"
    CAR = "car"
    LIFE_INSURANCE = "life_insurance"


class SocialSecurityStatus(StrEnum):
    NONE = "none"
    PENSION_INSURANCE = "pension_insurance"
    LONG_TERM_CARE_INSURANCE = "long_term_care_insurance"


class HeatingType(StrEnum):
    STOVE_HEATING = "stove_heating"
    GAS_HEATING = "gas_heating"
