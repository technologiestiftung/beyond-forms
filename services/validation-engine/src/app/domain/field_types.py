import decimal
from datetime import date
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, AfterValidator, BeforeValidator

from app.domain.registry import field_registry
from app.validators.field_type_validators import (
    validate_phone_number_format,
    validate_date_is_not_future,
    validate_date_is_in_future,
    validate_german_zip_code,
    validate_non_empty_string,
)
from app.validators.ocr_preprocessors import (
    clean_decimal_string,
    parse_date_string,
    parse_boolean,
)
from app.domain.global_enums import CoercedCountry, CoercedGender


NonEmptyString = Annotated[str, AfterValidator(validate_non_empty_string)]
PhoneNumber = Annotated[str, AfterValidator(validate_phone_number_format)]
PastDate = Annotated[date, BeforeValidator(parse_date_string), AfterValidator(validate_date_is_not_future)]
FutureDate = Annotated[date, BeforeValidator(parse_date_string), AfterValidator(validate_date_is_in_future)]
PositiveInteger = Annotated[int, BeforeValidator(clean_decimal_string), Field(gt=0)]
Percentage = Annotated[float, Field(ge=0.0, le=100.0)]
CareDependencyLevel = Annotated[int, Field(ge=1, le=5)]
GermanZipCode = Annotated[str, AfterValidator(validate_german_zip_code)]

CoercedDecimal = Annotated[decimal.Decimal, BeforeValidator(clean_decimal_string)]
CoercedDate = Annotated[date, BeforeValidator(parse_date_string)]
CoercedBool = Annotated[bool, BeforeValidator(parse_boolean)]


class PostalAddress(BaseModel):
    street_name: str
    house_number: str
    city: str
    zip_code: GermanZipCode


field_registry.register("non_empty_string", NonEmptyString)
field_registry.register("email_address", EmailStr)
field_registry.register("international_phone_number", PhoneNumber)
field_registry.register("past_or_present_date", PastDate)
field_registry.register("future_date", FutureDate)
field_registry.register("positive_integer", PositiveInteger)
field_registry.register("percentage", Percentage)
field_registry.register("postal_address", PostalAddress)
field_registry.register("care_dependency_level", CareDependencyLevel)
field_registry.register("german_zip_code", GermanZipCode)
field_registry.register("coerced_decimal", CoercedDecimal)
field_registry.register("coerced_date", CoercedDate)
field_registry.register("coerced_bool", CoercedBool)
field_registry.register("CountryCode", CoercedCountry)
field_registry.register("Gender", CoercedGender)

# @add_new_field
# MyNewField = Annotated[str, AfterValidator(some_validation_function)]
# field_registry.register("my_new_field", MyNewField)
