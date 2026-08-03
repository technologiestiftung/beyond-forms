# Exported PDFs

Generated artefacts, not source. Regenerate any time:

```bash
./scripts/seed_demo_personas.sh
./scripts/export_demo_pdfs.sh          # or: ./scripts/export_demo_pdfs.sh helmut
```

Per persona:

- `antrag_grundsicherung.pdf` — the filled application, exactly what `GET /export/antrag_grundsicherung` returns.
- `documents/<status>_<slot>_<filename>` — every document blob the account holds, prefixed
  with its processing status so the state is visible in a file listing.

## What to expect

| | Filled AcroForm fields | Documents |
|---|---|---|
| helmut | 63 | 13 verified |
| sabine | 57 | 3 verified, 1 ready_for_review |
| sandor | 51 | 2 verified, 1 ready_for_review, 1 failed |

Out of 409 form fields. Most of the remainder are for household members 2–8 and for
sections that do not apply to a given persona (disability, inpatient accommodation,
displaced status, employment income). Helmut's are as filled as his situation permits —
the empty ones are empty *because* he has no disability, no employer and no assets, and
filling them would describe a different person.

`documents/` contains a mix of committed fixtures (the real Helmut Klar Personalausweis,
Mietvertrag and Versicherungsbescheinigung) and generated one-page PDFs watermarked
*DEMOBELEG – KEIN AMTLICHES DOKUMENT*. See [../assets/README.md](../assets/README.md) for
which is which and why.

Roughly 6 MB in total. If you would rather not track it, add `demo/exports/` to
`.gitignore` — nothing depends on these files being committed.
