import io
import os
import pytest
import pdfrw
from reportlab.pdfgen import canvas
from src.pdfs.fill_pdf import (
    fill_pdf_form,
    _pdf_literal_to_unicode,
    _resolve_choice_value,
    discover_fields,
)


def create_test_pdf_for_filling():
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    form = c.acroForm

    # 1. Normal field
    form.textfield(name="editable_field", x=10, y=10, width=100, height=20)

    # 2. Read-only field
    form.textfield(name="readonly_field", x=10, y=40, width=100, height=20, fieldFlags=1)

    # 3. Checkbox
    form.checkbox(name="test_checkbox", x=10, y=70, buttonStyle="check")

    # 4. Radio Group
    form.radio(name="test_radio", value="Option1", x=10, y=100, selected=True)
    form.radio(name="test_radio", value="Option2", x=10, y=120)

    c.showPage()
    c.save()
    return buffer.getvalue()


def test_fill_pdf_form_basic():
    pdf_bytes = create_test_pdf_for_filling()
    values = {"editable_field": "Hello World"}

    filled_pdf = fill_pdf_form(pdf_bytes, values)

    assert len(filled_pdf) > 0
    # Basic check: pdfrw can read it
    reader = pdfrw.PdfReader(fdata=filled_pdf)
    assert len(reader.pages) == 1


def test_fill_pdf_form_readonly_error():
    pdf_bytes = create_test_pdf_for_filling()
    values = {"readonly_field": "Should fail"}

    with pytest.raises(ValueError, match="Cannot fill read-only field"):
        fill_pdf_form(pdf_bytes, values, ignore_read_only=False)


def test_fill_pdf_form_checkbox():
    pdf_bytes = create_test_pdf_for_filling()

    # Valid boolean fill
    filled_pdf = fill_pdf_form(pdf_bytes, {"test_checkbox": True})
    assert len(filled_pdf) > 0

    # Valid string booleans (should be converted)
    assert fill_pdf_form(pdf_bytes, {"test_checkbox": "true"})
    assert fill_pdf_form(pdf_bytes, {"test_checkbox": "False"})
    assert fill_pdf_form(pdf_bytes, {"test_checkbox": "TRUE"})

    # Invalid type fill
    with pytest.raises(ValueError, match="requires a boolean value"):
        fill_pdf_form(pdf_bytes, {"test_checkbox": "Yes"})


def test_fill_pdf_form_radio():
    pdf_bytes = create_test_pdf_for_filling()

    # Valid option fill
    filled_pdf = fill_pdf_form(pdf_bytes, {"test_radio": "Option2"})
    assert len(filled_pdf) > 0

    # Empty string and Off should also be valid (representing unselected state)
    assert len(fill_pdf_form(pdf_bytes, {"test_radio": ""})) > 0
    assert len(fill_pdf_form(pdf_bytes, {"test_radio": "Off"})) > 0

    # Invalid option fill
    with pytest.raises(ValueError, match="Invalid value 'Invalid'"):
        fill_pdf_form(pdf_bytes, {"test_radio": "Invalid"})

    # Invalid type fill
    with pytest.raises(ValueError, match="requires a string value"):
        fill_pdf_form(pdf_bytes, {"test_radio": True})


def test_fill_pdf_form_readonly_override():
    pdf_bytes = create_test_pdf_for_filling()
    values = {"readonly_field": "Should work now"}

    filled_pdf = fill_pdf_form(pdf_bytes, values, ignore_read_only=True)
    assert len(filled_pdf) > 0


def test_fill_pdf_form_non_existing_field():
    pdf_bytes = create_test_pdf_for_filling()

    with pytest.raises(ValueError, match="does not exist in the PDF"):
        fill_pdf_form(pdf_bytes, {"non_existent": "value"})


def test_fill_pdf_form_empty_values():
    pdf_bytes = create_test_pdf_for_filling()
    with pytest.raises(ValueError, match="No field values specified"):
        fill_pdf_form(pdf_bytes, {})


def test_pdf_literal_to_unicode_decodes_octal_escapes():
    assert _pdf_literal_to_unicode("Neuk\\366lln") == "Neukölln"
    assert _pdf_literal_to_unicode("Tempelhof-Sch\\366neberg") == "Tempelhof-Schöneberg"


def test_resolve_choice_value_maps_unicode_to_pdf_literal_option():
    options = ["Mitte", "Neuk\\366lln", "Tempelhof-Sch\\366neberg"]
    assert _resolve_choice_value("Tempelhof-Schöneberg", options) == "Tempelhof-Sch\\366neberg"
    assert _resolve_choice_value("Mitte", options) == "Mitte"


def test_fill_grunsicherung_bezirksamt_sets_option_index():
    pdf_path = os.path.join(os.path.dirname(__file__), "../../../../forms/pdfs/antrag_grundsicherung.pdf")
    if not os.path.exists(pdf_path):
        pytest.skip("antrag_grundsicherung.pdf not available")

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    filled_pdf = fill_pdf_form(pdf_bytes, {"p1_bezirksamt": "Mitte"}, ignore_read_only=True)
    field = discover_fields(pdfrw.PdfReader(fdata=filled_pdf))["Bezirksamt"]
    assert str(field.root.get("/V")) == "(Mitte)"
    assert int(field.root.get("/I")) == 5
    assert field.widgets[0].get("/AP") is not None


def test_fill_pdf_form_no_acroform():
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    c.drawString(10, 10, "Static Text")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()

    # Should error even if no values are provided because it's not fillable
    with pytest.raises(ValueError, match="PDF is not fillable"):
        fill_pdf_form(pdf_bytes, {})

    # Should error if values are provided for non-existing fields (and not fillable)
    with pytest.raises(ValueError, match="does not exist in the PDF"):
        fill_pdf_form(pdf_bytes, {"any": "thing"})
