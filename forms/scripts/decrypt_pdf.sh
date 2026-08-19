#!/bin/bash
# decrypt_pdf.sh - Strips PDF encryption in place (assumes empty user password).
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_pdf>"
    exit 1
fi

PDF_PATH="$1"
if [ ! -f "$PDF_PATH" ]; then
    echo "Error: File not found: $PDF_PATH"
    exit 1
fi

uv run --no-project --with pikepdf python3 -c "
import sys
import pikepdf

path = sys.argv[1]
with pikepdf.open(path, allow_overwriting_input=True) as pdf:
    pdf.save(path)
" "$PDF_PATH"

echo "Decrypted: $PDF_PATH"
