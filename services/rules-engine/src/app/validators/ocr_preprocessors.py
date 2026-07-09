import re
import decimal
import datetime
from typing import Any, Optional


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


def parse_date_string(val: Any) -> Optional[datetime.date]:
    if not val:
        return None
    if isinstance(val, datetime.date):
        return val
    if isinstance(val, datetime.datetime):
        return val.date()
    s = str(val).strip()
    s = re.sub(r"\s+", "", s)
    formats = ["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_boolean(val: Any) -> Optional[bool]:
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    s = str(val).strip().lower()
    if s in ("ja", "yes", "true", "1", "t", "y"):
        return True
    if s in ("nein", "no", "false", "0", "f", "n"):
        return False
    return None


def normalize_nationality_string(val: Any) -> Optional[str]:
    if not val:
        return None
    val_clean = str(val).strip().upper()
    mapping = {
        "DEUTSCH": "DE",
        "DEUTSCHE": "DE",
        "DEUTSCHLAND": "DE",
        "GERMAN": "DE",
        "GERMANY": "DE",
        "DE": "DE",
        "DEU": "DE",
        "POLNISCH": "PL",
        "POLISH": "PL",
        "POLAND": "PL",
        "PL": "PL",
        "UKRAINISCH": "UA",
        "UKRAINIAN": "UA",
        "UKRAINE": "UA",
        "UA": "UA",
        "FRANZÖSISCH": "FR",
        "FRENCH": "FR",
        "FRANCE": "FR",
        "FR": "FR",
        "ÖSTERREICHISCH": "AT",
        "AUSTRIAN": "AT",
        "AUSTRIA": "AT",
        "AT": "AT",
        "SCHWEIZER": "CH",
        "SWISS": "CH",
        "SWITZERLAND": "CH",
        "CH": "CH",
        "BRITISCH": "GB",
        "BRITISH": "GB",
        "UNITED KINGDOM": "GB",
        "GB": "GB",
        "TSCHECHISCH": "CZ",
        "CZECH": "CZ",
        "CZECH REPUBLIC": "CZ",
        "CZ": "CZ",
        "NIEDERLÄNDISCH": "NL",
        "DUTCH": "NL",
        "NETHERLANDS": "NL",
        "NL": "NL",
        "TÜRKISCH": "TR",
        "TURKISH": "TR",
        "TURKEY": "TR",
        "TR": "TR",
        "AMERIKANISCH": "US",
        "AMERICAN": "US",
        "UNITED STATES": "US",
        "US": "US",
        "KANADISCH": "CA",
        "CANADIAN": "CA",
        "CANADA": "CA",
        "CA": "CA",
        "ITALIENISCH": "IT",
        "ITALIAN": "IT",
        "ITALY": "IT",
        "IT": "IT",
        "SPANISCH": "ES",
        "SPANISH": "ES",
        "SPAIN": "ES",
        "ES": "ES",
        "PORTUGIESISCH": "PT",
        "PORTUGAL": "PT",
        "PRT": "PT",
    }
    return mapping.get(val_clean, val_clean)


def normalize_gender_string(val: Any) -> Optional[str]:
    if val is None or val == "":
        return None
    val_upper = str(val).strip().upper()
    mapping = {
        "M": "MALE",
        "MALE": "MALE",
        "F": "FEMALE",
        "FEMALE": "FEMALE",
        "D": "NON_BINARY",
        "DIVERSE": "NON_BINARY",
        "NON_BINARY": "NON_BINARY",
        "<": "NON_BINARY",
    }
    return mapping.get(val_upper)
