"""
Resolves the document blobs that back demo personas.

Every seeded document needs a real object in GCS: `UserService.cleanup_missing_gcs_files`
demotes any verified document whose blob is absent to FAILED, and it runs from
`GET /profile` and `GET /files`. A metadata-only seed decays on the first page load.

Blobs are either a committed fixture found along `DEMO_ASSETS_PATH`, or a generated
one-page PDF rendering the document's own `raw_data` — used where no fixture exists, and
where a fixture's figures would contradict the persona.
"""

import datetime
import decimal
import io
import logging
import os
from pathlib import Path
from typing import Any, Optional, Union

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

DEFAULT_ASSETS_PATH = "/app/demo/assets/documents:/app/services/wallet-frontend/tests/fixtures"

WATERMARK_TEXT = "DEMOBELEG – KEIN AMTLICHES DOKUMENT"

_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".bmp": "image/bmp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}

# Human labels for the raw_data keys the personas use, so a generated document reads
# like the paper it stands in for rather than like a JSON dump. Falls back to a
# de-underscored key, so an unlisted field still renders sensibly.
_FIELD_LABELS = {
    "account_balance": "Kontostand",
    "account_holder_name": "Kontoinhaber:in",
    "address": "Anschrift",
    "amount_health_insurance": "Krankenversicherung (monatlich)",
    "amount_liability_insurance": "Haftpflicht-/Hausratversicherung (monatlich)",
    "amount_pension": "Rente (monatlich)",
    "amount_rent": "Miete (monatlich)",
    "annual_consumption_amount_kwh_per_square_meter": "Jahresverbrauch (kWh/m²)",
    "annual_total_heating_costs": "Heizkosten (Jahr, gesamt)",
    "balance_due": "Abrechnungssaldo",
    "billing_period": "Abrechnungszeitraum",
    "case_number": "Aktenzeichen",
    "date_of_birth": "Geburtsdatum",
    "date_of_issue": "Ausstellungsdatum",
    "document_id": "Dokumentnummer",
    "end_date_of_pension": "Rente bis",
    "end_date_of_rent": "Mietende",
    "fuel_type": "Energieträger",
    "full_name": "Name",
    "gender": "Geschlecht",
    "given_names": "Vornamen",
    "has_sub_tenants": "Untermieter:innen",
    "health_insurance_status": "Versicherungsart",
    "heating_costs": "Heizkosten (monatlich)",
    "heating_costs_regardless_of_usage": "Heizkosten (verbrauchsunabhängig)",
    "heating_costs_usage_based": "Heizkosten (verbrauchsabhängig)",
    "iban": "IBAN",
    "insurance_name": "Versicherung",
    "is_granted": "Bewilligt",
    "is_main_tenant": "Hauptmieter:in",
    "issuing_authority": "Ausstellende Behörde",
    "last_name": "Name",
    "monthly_amount": "Monatlicher Betrag",
    "monthly_total_rent": "Warmmiete (monatlich)",
    "nationality": "Staatsangehörigkeit",
    "net_cold_rent": "Nettokaltmiete (monatlich)",
    "operating_costs": "Betriebskosten (monatlich)",
    "pension_insurance_number": "Rentenversicherungsnummer",
    "pension_reason": "Rentenart",
    "place_of_birth": "Geburtsort",
    "place_of_issue": "Ausstellungsort",
    "square_meters": "Wohnfläche (m²)",
    "start_date_of_pension": "Rente ab",
    "start_date_of_rent": "Mietbeginn",
    "statement_date": "Auszugsdatum",
    "statement_period_end": "Zeitraum bis",
    "statement_period_start": "Zeitraum von",
    "tenant_address": "Anschrift Mieter:in",
    "tenant_name": "Mieter:in",
    "valid_until": "Gültig bis",
    "warm_water_costs_regardless_of_usage": "Warmwasser (verbrauchsunabhängig)",
    "warm_water_costs_usage_based": "Warmwasser (verbrauchsabhängig)",
}

_MONEY_FIELDS = frozenset(
    key
    for key in _FIELD_LABELS
    if key.startswith("amount_")
    or "costs" in key
    or "rent" in key
    or key in {"monthly_amount", "account_balance", "balance_due"}
)


def content_type_for(filename: str) -> str:
    return _CONTENT_TYPES.get(Path(filename).suffix.lower(), "application/octet-stream")


def asset_search_path() -> list[Path]:
    raw = os.environ.get("DEMO_ASSETS_PATH", DEFAULT_ASSETS_PATH)
    return [Path(part) for part in raw.split(":") if part]


def _find_fixture(filename: str) -> Optional[Path]:
    for directory in asset_search_path():
        candidate = directory / filename
        if candidate.is_file():
            return candidate
    return None


def _format_value(key: str, value: Any) -> str:
    if isinstance(value, bool):
        return "Ja" if value else "Nein"
    if isinstance(value, (decimal.Decimal, float, int)) and key in _MONEY_FIELDS:
        return f"{decimal.Decimal(str(value)):,.2f} €".replace(",", " ").replace(".", ",", 1)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.strftime("%d.%m.%Y")
    text = str(value)
    # Persona raw_data holds JSON-native primitives, so dates arrive as ISO strings.
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        try:
            return datetime.date.fromisoformat(text).strftime("%d.%m.%Y")
        except ValueError:
            pass
    return text


def generate_demo_pdf(title: str, subtitle: Optional[str], raw_data: dict[str, Any]) -> bytes:
    """
    Renders a one-page A4 PDF listing `raw_data` under a diagonal watermark.

    Rendering the document's own extracted values keeps the blob and the database row
    consistent by construction: whoever opens the document during a demo sees exactly
    the fields they are being asked to verify.
    """
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setTitle(title)
    pdf.setAuthor("BeyondForms Demo")
    pdf.setSubject("Synthetisches Demo-Dokument – keine echten personenbezogenen Daten")

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(25 * mm, height - 30 * mm, title)

    cursor = height - 38 * mm
    if subtitle:
        pdf.setFont("Helvetica", 11)
        pdf.setFillColor(colors.HexColor("#555555"))
        pdf.drawString(25 * mm, cursor, subtitle)
        pdf.setFillColor(colors.black)
        cursor -= 8 * mm

    pdf.setStrokeColor(colors.HexColor("#999999"))
    pdf.line(25 * mm, cursor, width - 25 * mm, cursor)
    cursor -= 12 * mm

    if raw_data:
        for key, value in raw_data.items():
            if value is None:
                continue
            if cursor < 40 * mm:
                pdf.setFont("Helvetica-Oblique", 9)
                pdf.drawString(25 * mm, cursor, "… weitere Angaben abgeschnitten")
                break
            pdf.setFont("Helvetica", 10)
            pdf.setFillColor(colors.HexColor("#444444"))
            pdf.drawString(25 * mm, cursor, _FIELD_LABELS.get(key, key.replace("_", " ")))
            pdf.setFillColor(colors.black)
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(105 * mm, cursor, _format_value(key, value))
            cursor -= 7 * mm
    else:
        # Documents seeded as `failed` carry no extraction — say so rather than
        # rendering a blank page that looks like a rendering bug.
        pdf.setFont("Helvetica-Oblique", 10)
        pdf.drawString(25 * mm, cursor, "Keine Daten ausgelesen – dieses Dokument konnte nicht verarbeitet werden.")

    pdf.setFont("Helvetica-Oblique", 8)
    pdf.setFillColor(colors.HexColor("#777777"))
    pdf.drawString(
        25 * mm,
        18 * mm,
        "Synthetisches Demo-Dokument der BeyondForms-Testumgebung. Enthält keine echten personenbezogenen Daten.",
    )

    pdf.saveState()
    pdf.setFillColor(colors.HexColor("#C00000"), alpha=0.13)
    pdf.setFont("Helvetica-Bold", 30)
    pdf.translate(width / 2, height / 2)
    pdf.rotate(38)
    pdf.drawCentredString(0, 0, WATERMARK_TEXT)
    pdf.restoreState()

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def resolve_asset(
    asset: Union[str, dict[str, Any]],
    display_name: str,
    raw_data: dict[str, Any],
) -> tuple[bytes, str, str]:
    """
    Returns `(content, content_type, source_description)` for one persona document.

    A string `asset` names a committed fixture; a `{"generate": true, ...}` asset builds
    a PDF from `raw_data`. A named fixture that cannot be found falls back to generation
    with a warning, so a missing file degrades the demo rather than breaking the seed.
    """
    if isinstance(asset, dict):
        content = generate_demo_pdf(asset["title"], asset.get("subtitle"), raw_data)
        return content, "application/pdf", f"generated:{asset['title']}"

    path = _find_fixture(asset)
    if path is not None:
        return path.read_bytes(), content_type_for(path.name), f"fixture:{path}"

    logger.warning(
        "Demo asset %r not found on DEMO_ASSETS_PATH (%s); generating a stand-in instead.",
        asset,
        ":".join(str(p) for p in asset_search_path()),
    )
    content = generate_demo_pdf(Path(display_name).stem.replace("_", " "), None, raw_data)
    return content, "application/pdf", f"generated-fallback:{asset}"
