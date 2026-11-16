import re


def parse_address(address_str: str) -> dict[str, str]:
    if not address_str:
        return {"street": "", "house_number": "", "zip_code": "", "city": ""}

    address_str = address_str.strip()
    zip_match = re.search(r"\b\d{5}\b", address_str)

    zip_code = ""
    city = ""
    street_and_hn = address_str

    if zip_match:
        zip_code = zip_match.group(0)
        start_idx, end_idx = zip_match.span()
        before = address_str[:start_idx].strip(", \t\n\r")
        after = address_str[end_idx:].strip(", \t\n\r")

        if not before:
            parts = re.split(r"[,\n]", after, maxsplit=1)
            city = parts[0].strip()
            street_and_hn = parts[1].strip() if len(parts) > 1 else ""
        elif not after:
            street_and_hn = before
            city = ""
        else:
            street_and_hn = before
            city = after

    street = street_and_hn
    house_number = ""

    if street_and_hn:
        match = re.match(r"^(?P<street>.+)\s+(?P<house_number>\d+.*)$", street_and_hn)
        if match:
            street = match.group("street").strip(", \t\n\r")
            house_number = match.group("house_number").strip(", \t\n\r")

    return {
        "street": street,
        "house_number": house_number,
        "zip_code": zip_code,
        "city": city,
    }
