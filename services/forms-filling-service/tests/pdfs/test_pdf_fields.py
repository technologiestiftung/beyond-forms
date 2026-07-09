import io
from reportlab.pdfgen import canvas
from src.pdfs.pdf_fields import get_pdf_fields


def create_simple_pdf():
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    form = c.acroForm

    # Add a text field
    form.textfield(
        name="test_text",
        x=10,
        y=10,
        width=100,
        height=20,
        tooltip="This is a tooltip",
    )

    # Add a checkbox
    form.checkbox(name="test_check", x=10, y=40, buttonStyle="check")

    # Add a radio group
    form.radio(name="test_radio", value="V1", x=10, y=70, selected=True)
    form.radio(name="test_radio", value="V2", x=10, y=90)

    # Add a choice field (dropdown)
    form.choice(
        name="test_choice",
        x=10,
        y=120,
        width=100,
        height=20,
        options=["Choice1", "Choice2", "Choice3"],
        value="Choice1",
    )

    c.showPage()
    c.save()
    return buffer.getvalue()


def test_get_pdf_fields_discovery():
    pdf_bytes = create_simple_pdf()
    fields = get_pdf_fields(pdf_bytes)

    # Map by name for easy checking
    field_map = {f["name"]: f for f in fields}

    assert "test_text" in field_map
    assert field_map["test_text"]["type"] == "string"
    assert field_map["test_text"]["description"] == "This is a tooltip"
    assert len(field_map["test_text"]["options"]) == 0

    assert "test_check" in field_map
    assert field_map["test_check"]["type"] == "checkbox"
    assert len(field_map["test_check"]["options"]) == 0

    assert "test_radio" in field_map
    assert field_map["test_radio"]["type"] == "radio"
    assert "V1" in field_map["test_radio"]["options"]
    assert "V2" in field_map["test_radio"]["options"]

    assert "test_choice" in field_map
    assert field_map["test_choice"]["type"] == "choice"
    assert field_map["test_choice"]["options"] == ["Choice1", "Choice2", "Choice3"]


def test_get_pdf_fields_empty():
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    c.drawString(10, 10, "No forms here")
    c.showPage()
    c.save()

    fields = get_pdf_fields(buffer.getvalue())
    assert len(fields) == 0
