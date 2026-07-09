import os
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
    pdf_path = os.path.join(current_dir, "test_data", "antrag_grundsicherung_sot.pdf")
    reader = pdfrw.PdfReader(pdf_path)
    found_values = _find_values(reader)
    print("\n--- CLEAN POPULATED SOT PDF FIELDS ---")
    for key, value in sorted(found_values.items()):
        v_strip = value.strip()
        if v_strip and v_strip != "()" and v_strip != "/Off":
            print(f"{key}: {value}")
    print("--------------------------------------\n")


if __name__ == "__main__":
    main()
