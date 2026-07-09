import os
import sys
import pdfrw
from src.pdfs.utils import get_full_name


def decode_pdf_string(s):
    if s is None:
        return ""
    val_str = str(s)
    if val_str.startswith("("):
        val_str = val_str[1:-1]
    if val_str.startswith("þÿ") or val_str.startswith("\xfe\xff"):
        try:
            resolved = val_str.encode("latin-1", errors="replace").decode("unicode-escape")
            resolved_bytes = resolved.encode("latin-1", errors="replace")
            decoded = resolved_bytes.decode("utf-16-be", errors="replace")
            if decoded.startswith("\ufeff"):
                decoded = decoded[1:]
            return decoded
        except Exception:
            pass
    return val_str


def _find_values(pdf):
    results = {}

    def walk(fields):
        for f in fields:
            name = get_full_name(f)
            if name:
                decoded_name = decode_pdf_string(name)
                val = f.get("/V")
                decoded_val = decode_pdf_string(val)
                if decoded_val:
                    results[decoded_name] = decoded_val
            if f.get("/Kids"):
                walk(f.get("/Kids"))

    if pdf.Root.AcroForm and pdf.Root.AcroForm.Fields:
        walk(pdf.Root.AcroForm.Fields)
    return results


def main():
    current_dir = os.path.dirname(__file__)
    sot_path = os.path.join(current_dir, "test_data", "antrag_grundsicherung_sot.pdf")
    gen_path = os.path.join(current_dir, "test_data", "generated_antrag.pdf")

    if not os.path.exists(gen_path):
        print(f"CRITICAL ERROR: Generated PDF not found at {gen_path}", file=sys.stderr)
        sys.exit(1)

    sot_reader = pdfrw.PdfReader(sot_path)
    gen_reader = pdfrw.PdfReader(gen_path)

    sot_values = _find_values(sot_reader)
    gen_values = _find_values(gen_reader)

    mismatches = []
    for key, sot_val in sorted(sot_values.items()):
        s_strip = sot_val.strip()
        if not s_strip or s_strip == "()" or s_strip == "/Off":
            continue

        gen_val = gen_values.get(key, "").strip()

        # Normalize values for comparison (like stripping / from radio/checkbox choices if compared to raw string)
        sot_norm = (
            s_strip.replace("/On", "Ja")
            .replace("/Ja", "Ja")
            .replace("/Nein", "Nein")
            .replace("/0", "0")
            .replace("/1", "1")
        )
        gen_norm = (
            gen_val.replace("/On", "Ja")
            .replace("/Ja", "Ja")
            .replace("/Nein", "Nein")
            .replace("/0", "0")
            .replace("/1", "1")
        )

        if sot_norm != gen_norm:
            mismatches.append((key, s_strip, gen_val))

    if mismatches:
        print("\n❌ PDF FIELD COMPARISON FAILED:")
        print(f"{'Field Name':<60} | {'Expected SOT':<30} | {'Generated Value':<30}")
        print("-" * 126)
        for key, expected, actual in mismatches:
            print(f"{key:<60} | {expected:<30} | {actual:<30}")
        print(f"\nTotal mismatched fields: {len(mismatches)}\n")
        sys.exit(1)
    else:
        print("\n✅ PDF FIELD COMPARISON PASSED: Generated PDF matches UX SOT perfectly!\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
