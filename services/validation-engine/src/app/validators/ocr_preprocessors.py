import re
import decimal
import datetime
from typing import Any, Optional
from app.domain.global_enums import Gender

def clean_decimal_string(val: Any) -> Optional[decimal.Decimal]:
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return decimal.Decimal(str(val))
    if isinstance(val, decimal.Decimal):
        return val
    s = str(val).strip().upper()
    s = re.sub(r"[^\d,\.\-]", "", s)
    s = re.sub(r",\-+$", ",00", s)
    s = re.sub(r"\.+$", "", s)
    if not s:
        return None
    if "," in s and "." in s:
        if s.find(".") < s.find(","):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return decimal.Decimal(s)
    except (decimal.InvalidOperation, ValueError):
        return None


def parse_date_string(val: Any) -> Any:
    if isinstance(val, datetime.datetime):
        return val.date()
    if isinstance(val, str):
        s = val.strip()
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.datetime.strptime(s, fmt).date()
            except ValueError:
                pass
    return val

def parse_german_bool(val: Any) -> Any:
    if isinstance(val, str):
        s = val.strip().lower()
        if s in ("ja", "j"):
            return True
        if s == "nein":
            return False
    return val

_GENDER_MAP = {
    "M": Gender.MALE, "MALE": Gender.MALE,
    "F": Gender.FEMALE, "FEMALE": Gender.FEMALE,
    "D": Gender.NON_BINARY, "DIVERSE": Gender.NON_BINARY,
    "NON_BINARY": Gender.NON_BINARY,
}

def normalize_gender_string(val: Any) -> Any:
    if isinstance(val, str):
        return _GENDER_MAP.get(val.strip().upper(), val)
    return val
