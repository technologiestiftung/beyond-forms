import decimal
from datetime import date
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, BeforeValidator, PastDate, FutureDate, PositiveInt, StringConstraints
from pydantic_extra_types.country import CountryAlpha2
from pydantic_extra_types.phone_numbers import PhoneNumberValidator

from app.domain.registry import field_registry
from app.validators.ocr_preprocessors import (
    clean_decimal_string,
    parse_date_string,
    parse_german_bool,
    normalize_gender_string
)
from app.domain.global_enums import Gender


NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PhoneNumber = Annotated[str, PhoneNumberValidator(default_region="DE", number_format="E164")]
Percentage = Annotated[float, Field(ge=0.0, le=100.0)]
CareDependencyLevel = Annotated[int, Field(ge=1, le=5)]
GermanZipCode = Annotated[str, Field(pattern=r"^\d{5}$")]

CoercedDecimal = Annotated[decimal.Decimal, BeforeValidator(clean_decimal_string)]
CoercedDate = Annotated[date, BeforeValidator(parse_date_string)]
CoercedPastDate = Annotated[PastDate, BeforeValidator(parse_date_string)]
CoercedFutureDate = Annotated[FutureDate, BeforeValidator(parse_date_string)]
CoercedBool = Annotated[bool, BeforeValidator(parse_german_bool)]
CoercedCountry = CountryAlpha2
CoercedGender = Annotated[Gender, BeforeValidator(normalize_gender_string)]



class PostalAddress(BaseModel):
    street_name: str
    house_number: str
    city: str
    zip_code: GermanZipCode


field_registry.register("non_empty_string", NonEmptyString)
field_registry.register("email_address", EmailStr)
field_registry.register("international_phone_number", PhoneNumber)
field_registry.register("past_date", PastDate)
field_registry.register("future_date", FutureDate)
field_registry.register("positive_integer", PositiveInt)
field_registry.register("percentage", Percentage)
field_registry.register("postal_address", PostalAddress)
field_registry.register("care_dependency_level", CareDependencyLevel)
field_registry.register("german_zip_code", GermanZipCode)
field_registry.register("coerced_decimal", CoercedDecimal)
field_registry.register("coerced_date", CoercedDate)
field_registry.register("coerced__past_date", CoercedPastDate)
field_registry.register("coerced_future_date", CoercedFutureDate)
field_registry.register("coerced_bool", CoercedBool)
field_registry.register("coerced_country", CoercedCountry)
field_registry.register("coerced_gender", CoercedGender)

# @add_new_field
# MyNewField = Annotated[str, AfterValidator(some_validation_function)]
# field_registry.register("my_new_field", MyNewField)
