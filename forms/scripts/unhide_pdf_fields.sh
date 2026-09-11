#!/bin/bash
# unhide_pdf_fields.sh - Clears the AcroForm "Hidden" annotation flag on every widget, in place.
#
# Some official PDFs ship form fields flagged Hidden+Print: they still take a value and
# still print, but no viewer ever draws them on screen, so a correctly filled field looks
# blank to anyone opening the PDF. Run this once on a template after downloading/replacing
# it to make every field it defines actually visible.
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

HIDDEN_BIT = 2  # PDF spec 12.5.3, Table 165: bit position 2 is the Hidden flag.

path = sys.argv[1]
with pikepdf.open(path, allow_overwriting_input=True) as pdf:
    fixed = 0
    for page in pdf.pages:
        for annot in page.get('/Annots', []):
            if annot.get('/Subtype') != pikepdf.Name.Widget:
                continue
            flags = int(annot.get('/F', 0))
            if flags & HIDDEN_BIT:
                annot.F = flags & ~HIDDEN_BIT
                fixed += 1
    pdf.save(path)
    print(f'Unhid {fixed} widget(s) in {path}')
" "$PDF_PATH"
