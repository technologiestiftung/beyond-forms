"""
Utility script to generate a comprehensive fillable PDF for testing the forms-filling-service.

This script creates a PDF containing various types of interactive form elements:
- Visible Text Fields (Single-line and Multiline)
- Visible Checkboxes and Radio Groups
- Visible Dropdown (Choice) menus
- Read-only Status Indicators (intended for visual verification of hidden field state)
- Hidden Fields (Text, Multiline, Checkbox, Choice, Radio) that exist logically but not visually

Usage:
    python3 generate_pdf_for_testing.py [output_path.pdf]

Example (within the service container):
    docker compose run --rm forms-filling-service python3 scripts/generate_pdf_for_testing.py scripts/fillable_test_input.pdf

Dependencies:
    reportlab (can be installed via `pip install reportlab`)

The generated PDF is used to verify that the extraction logic correctly identifies
all field types, including those that are hidden or read-only, and that the filling
logic correctly populates them according to PDF standards.
"""

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
import sys


def create_fillable_pdf(output_path):
    """
    Generates a fillable PDF with a variety of field types and visibility states.
    """
    c = canvas.Canvas(output_path, pagesize=letter)

    c.setFont("Helvetica", 16)
    c.drawString(50, 760, "Forms Filling Service - Exhaustive Test Form")

    # --- Visible Fields ---
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 730, "VISIBLE ELEMENTS")
    c.line(50, 725, 200, 725)
    c.setFont("Helvetica", 12)

    form = c.acroForm

    # 1. Text Field 1: Standard single-line input
    c.drawString(50, 700, "Text Field 1:")
    form.textfield(
        name="visible_text_1",
        tooltip="Visible Text 1",
        x=150,
        y=695,
        width=300,
        height=20,
        textColor=colors.black,
        borderStyle="underlined",
    )

    # 2. Multiline Text 1: Input field with the Multiline flag (bit 13)
    c.drawString(50, 660, "Multiline 1:")
    form.textfield(
        name="visible_multiline_1",
        tooltip="Visible Multiline 1",
        x=150,
        y=600,
        width=300,
        height=70,
        textColor=colors.black,
        fieldFlags=4096,
    )

    # 3. Checkboxes: Independent boolean toggles
    c.drawString(50, 575, "Checkboxes:")
    cb_labels = ["Checkbox Option 1", "Checkbox Option 2"]
    for i, label in enumerate(cb_labels, 1):
        y_pos = 573 - (i - 1) * 22
        form.checkbox(
            name=f"visible_checkbox_{i}",
            tooltip=label,
            x=150,
            y=y_pos,
            buttonStyle="check",
        )
        c.drawString(175, y_pos + 2, label)

    # 4. Dropdown 1: Single-selection choice menu
    c.drawString(50, 520, "Dropdown 1:")
    form.choice(
        name="visible_choice_1",
        tooltip="Visible Choice 1",
        x=150,
        y=515,
        width=150,
        height=20,
        options=["Dropdown Option 1", "Dropdown Option 2"],
        value="Dropdown Option 1",
    )

    # 5. Radio Group 1: Mutually exclusive selection group
    c.drawString(50, 485, "Radio Group 1:")
    radio_opts = ["Radio Mode A", "Radio Mode B"]
    for i, label in enumerate(radio_opts, 1):
        y_pos = 483 - (i - 1) * 22
        form.radio(
            name="visible_radio_1",
            value=label,
            x=150,
            y=y_pos,
            buttonStyle="circle",
            selected=(i == 1),
        )
        c.drawString(175, y_pos + 2, label)

    # --- Hidden Field Indicators ---
    # These are visible fields intended to be updated by a PDF reader's calculation engine
    # to indicate whether corresponding hidden fields have been filled.
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 420, "HIDDEN FIELD INDICATORS")
    c.line(50, 415, 250, 415)
    c.setFont("Helvetica", 10)

    hidden_fields = [
        "hidden_text_1",
        "hidden_multiline_1",
        "hidden_checkbox_1",
        "hidden_choice_1",
        "hidden_radio_1",
    ]

    for i, h_name in enumerate(hidden_fields):
        y_pos = 385 - i * 25
        status_name = f"status_{h_name}"
        c.drawString(50, y_pos + 5, f"Status of {h_name}:")

        # Create a read-only field that will show the status
        form.textfield(
            name=status_name,
            value=f"Field {h_name} is NOT filled",
            x=200,
            y=y_pos,
            width=250,
            height=20,
            textColor=colors.red,
            fieldFlags=1,
        )  # ReadOnly

    # --- Hidden Fields (Actual data targets) ---
    # These fields are created with annotationFlags=2 (Hidden) and/or zero dimensions.
    # They should be discoverable by the service's logical tree scan.
    form.textfield(name="hidden_text_1", x=0, y=0, width=0, height=0, annotationFlags=2)
    form.textfield(
        name="hidden_multiline_1",
        x=0,
        y=0,
        width=0,
        height=0,
        annotationFlags=2,
        fieldFlags=4096,
    )
    form.checkbox(name="hidden_checkbox_1", x=0, y=0, annotationFlags=2)
    form.choice(
        name="hidden_choice_1",
        x=0,
        y=0,
        width=0,
        height=0,
        options=["Dropdown H1", "Dropdown H2"],
        value="Dropdown H1",
    )
    for i in range(1, 3):
        form.radio(name="hidden_radio_1", value=f"Radio H{i}", x=0, y=0, annotationFlags=2)

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(
        50,
        240,
        "Note: Computation must be performed by the PDF viewer (e.g. Acrobat/Chrome).",
    )

    c.save()
    print(f"SUCCESS: Created exhaustive test PDF at {output_path}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "fillable_test_input.pdf"
    create_fillable_pdf(out)
