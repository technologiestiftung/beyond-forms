"""
Script to list all fillable fields in a PDF by calling the forms-filling-service.

Usage:
    python3 list_pdf_fields.py <path_to_pdf> [--base-url <url>]

Example:
    python3 list_pdf_fields.py scripts/test.pdf
"""

import argparse
import base64
import json
import os
import sys

import requests

DEFAULT_BASE_URL = "http://localhost:8005/api"


def get_pdf_b64(pdf_path):
    with open(pdf_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def list_fields(pdf_path, base_url):
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    print(f"Extracting fields from: {pdf_path} using {base_url}...")

    payload = {"pdf_base64": get_pdf_b64(pdf_path)}
    try:
        response = requests.post(f"{base_url}/fields", json=payload)
    except requests.exceptions.RequestException as e:
        print(f"Connection error: {e}")
        sys.exit(1)

    if response.status_code == 200:
        data = response.json()
        fields = data.get("fields", [])
        print(f"Successfully found {len(fields)} logical fields.\n")
        print(json.dumps(fields, indent=2))
    else:
        print(f"Error {response.status_code}: {response.text}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="List fillable fields in a PDF.")
    parser.add_argument("pdf_path", help="Path to the PDF file.")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL of the service (default: {DEFAULT_BASE_URL})",
    )

    args = parser.parse_args()
    list_fields(args.pdf_path, args.base_url)
