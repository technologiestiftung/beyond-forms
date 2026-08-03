# Demo document assets

Every seeded document needs a real object in GCS. `UserService.cleanup_missing_gcs_files`
runs as a background task from `GET /profile` and `GET /files` and demotes any verified
document whose blob is missing to `FAILED` with `GCS_BLOB_MISSING`, so a metadata-only seed
decays on the first page load.

## Resolution order

A persona's `documents[].asset` is either a filename or `{"generate": true, "title": "…"}`.
Filenames are looked up along `DEMO_ASSETS_PATH`, a colon-separated list defaulting to:

```
/app/demo/assets/documents:/app/services/wallet-frontend/tests/fixtures
```

A filename that cannot be found anywhere falls back to generation with a warning — a missing
fixture degrades the demo rather than breaking the seed.

`documents/` in this directory is intentionally empty: the fixtures worth reusing already
live elsewhere and are referenced in place rather than duplicated. Put a file here only if it
belongs to the demo personas specifically and to nothing else.

## Where the existing fixtures live, and what they are for

- `services/wallet-frontend/tests/fixtures/` — real-looking Helmut Klar documents, plus
  `A_very_long_document_name_…pdf`, which exists to test UI truncation and is not a persona
  asset. `test-with-authenticated-user.ts` also lives there and is imported by the Playwright
  specs, which is why this directory is referenced rather than reorganised.
- `services/document-intelligence-service/resources/test-documents/` — inputs for Gemini
  extraction tests. A different consumer; not persona assets.

## Generated documents

Generated blobs are one-page A4 PDFs rendering the document's own `raw_data` as a labelled
table under a diagonal `DEMOBELEG – KEIN AMTLICHES DOKUMENT` watermark (~2.5 KB each, see
`src/services/demo_assets.py`). Two reasons to prefer them over authoring fake paperwork:

1. **Self-consistency by construction.** The PDF shows exactly the fields the database holds,
   so a reviewer clicking "view document" sees what they are being asked to verify. A
   hand-authored document drifts from `raw_data` the moment either changes. This is also why
   Helmut's committed Rentenbescheid, Heizkostenabrechnung and Kontoauszug are *not* reused:
   they carry the older €650 pension and €430.87 rent and would visibly contradict him.
2. **Unmistakable.** For a public-sector research project whose screen gets shared, a
   document that cannot be confused with a real Bescheid is a feature.

## Staging

The wallet-frontend fixtures are not in the middleware's Cloud Run image, so a named asset
will fall back to generation there. If you want the real blobs on staging, sync them once to
`gs://$GCS_BUCKET_NAME/demo-assets/` and extend the resolver to copy server-side with
`bucket.copy_blob` — that keeps ~20 MB of PNG and PDF out of every Cloud Build context.
