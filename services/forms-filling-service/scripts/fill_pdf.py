"""
Script to fill all writable fields in a PDF with sample data using the forms-filling-service.

Usage:
    python3 fill_pdf.py <path_to_pdf> [--output <output_path.pdf>] [--base-url <url>]

Example:
    python3 fill_pdf.py scripts/test.pdf --output filled_output.pdf
"""

import argparse
import base64
import os
import sys
import tempfile

import requests

DEFAULT_BASE_URL = "http://localhost:8005/api"


def get_pdf_b64(pdf_path):
    with open(pdf_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def fill_pdf(pdf_path, output_path, base_url):
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    # 1. Get Fields
    print(f"1. Fetching fields for: {pdf_path} using {base_url}...")
    pdf_b64 = get_pdf_b64(pdf_path)
    try:
        fields_resp = requests.post(f"{base_url}/fields", json={"pdf_base64": pdf_b64})
    except requests.exceptions.RequestException as e:
        print(f"Connection error: {e}")
        sys.exit(1)

    if fields_resp.status_code != 200:
        print(f"Error fetching fields ({fields_resp.status_code}): {fields_resp.text}")
        sys.exit(1)

    fields = fields_resp.json().get("fields", [])
    print(f"   Found {len(fields)} fields.")

    # 2. Generate Sample Data
    field_values = {}
    for f in fields:
        name = f["name"]
        if name in field_values:
            continue

        if f.get("read_only"):
            continue

        if f["type"] == "string":
            field_values[name] = f"Sample text for {name}"
        elif f["type"] == "checkbox":
            field_values[name] = True
        elif f["type"] == "radio":
            if f.get("options"):
                field_values[name] = f["options"][min(1, len(f["options"]) - 1)]
            else:
                field_values[name] = True
        elif f["type"] == "choice":
            if f.get("options"):
                field_values[name] = f["options"][min(1, len(f["options"]) - 1)]
            else:
                field_values[name] = "Option 1"

    # 3. Fill PDF
    print(f"2. Submitting {len(field_values)} sample values to /fill...")
    payload = {
        "pdf_base64": pdf_b64,
        "field_values": field_values,
        "ignore_read_only": False,
    }

    try:
        fill_resp = requests.post(f"{base_url}/fill", json=payload)
    except requests.exceptions.RequestException as e:
        print(f"Connection error: {e}")
        sys.exit(1)

    if fill_resp.status_code == 200:
        if not output_path:
            # Create a unique temp file if no output path provided
            tmp_dir = tempfile.mkdtemp(prefix="pdf_fill_")
            filename = os.path.basename(pdf_path)
            output_path = os.path.join(tmp_dir, f"filled_{filename}")

        with open(output_path, "wb") as f:
            f.write(fill_resp.content)

        print(f"SUCCESS: Populated PDF saved to: {output_path}")
        print(f"Size: {len(fill_resp.content)} bytes")
    else:
        print(f"Error filling PDF ({fill_resp.status_code}): {fill_resp.text}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fill all writable fields in a PDF with sample data.")
    parser.add_argument("pdf_path", help="Path to the PDF file.")
    parser.add_argument("--output", "-o", help="Path to the output PDF file.", default=None)
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL of the service (default: {DEFAULT_BASE_URL})",
    )

    args = parser.parse_args()
    fill_pdf(args.pdf_path, args.output, args.base_url)
