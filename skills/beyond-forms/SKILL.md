---
name: beyond-forms
description: "Use when working with BeyondForms / CityLAB Berlin social-benefits services — classifying or extracting German administrative documents (Rentenbescheid, Mietvertrag, Kontoauszug), validating form fields against the rules engine, filling AcroForm PDFs such as the Antrag auf Grundsicherung, or driving a demo citizen account over the hosted staging API. Staging is a live prototype environment rather than a fixture sandbox — profiles, uploaded documents and chat histories there can hold real personal data left by people testing the prototype, so treat everything retrieved from it as personal data rather than assuming it is synthetic."
version: 1.0.0
author: Technologiestiftung Berlin
license: MIT
metadata:
  hermes:
    tags: [beyond-forms, citylab, forms, document-intelligence, german-administration, rest-api]
---

# BeyondForms

## Overview

BeyondForms helps people in Berlin apply for social benefits: it reads their documents, works out what is still missing, and fills the official PDF application. It is built by CityLAB Berlin / Technologiestiftung Berlin.

Five services are callable with nothing but `curl` and `jq`. Everything here targets **staging** — a live prototype environment. Synthetic demo personas live there, but so does whatever real people have entered while testing, so it is not a safe-by-default sandbox. See the hard rules below before reading data out of it.

| Service | Base URL | Auth |
|---|---|---|
| Middleware (user data) | `$API` — `https://staging.bf.citylab-berlin.org/api` | Bearer token |
| Auth (issues the token) | `$AUTH` — `https://staging.bf.citylab-berlin.org/auth-proxy` | — |
| Rules engine | `$RULES` — from your project | none |
| Document intelligence | `$DOCS` — from your project | none |
| Forms filling | `$PDF` — from your project | none |

The middleware and auth services sit behind a public load balancer, so their hostnames are fixed:

```bash
API=https://staging.bf.citylab-berlin.org/api
AUTH=https://staging.bf.citylab-berlin.org/auth-proxy
```

The other three are internal Cloud Run services whose addresses are **deliberately not published**. Resolve them from the project instead of hardcoding them. With `gcloud` access to the project:

```bash
eval "$(gcloud run services list --project beyond-forms-staging --region europe-west10 \
  --format='value(metadata.name,status.url)' | awk '
    $1=="bf-stg-rules-engine"                  {print "export RULES="$2}
    $1=="bf-stg-document-intelligence-service" {print "export DOCS="$2}
    $1=="bf-stg-forms-filling-service"         {print "export PDF="$2}')"
```

Without project access, ask someone who has it for the three URLs and export them by hand. Do not commit them, paste them into a public issue, or include them in anything you publish.

Check what is reachable — each set variable returns `200`:

```bash
for u in $API $AUTH $RULES $DOCS $PDF; do printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' $u/health)"; done; echo
```

If `$RULES`, `$DOCS` and `$PDF` are unset, the demo-account workflow below still works in full — only document classification, field validation and PDF filling need them.

**What this needs from your environment:** a shell with `curl` and `jq`, and outbound HTTPS to the hosts above. `gcloud` is needed *only* to resolve those three addresses — everything reached through `$API` and `$AUTH` works without it. In a sandbox with no network egress, none of this is usable; say so rather than guessing at responses.

## When to Use

- Classifying or extracting data from German administrative documents — pension notices, rent contracts, bank statements, benefit decisions
- Validating form fields or whole benefit applications against the official rules
- Discovering or filling the AcroForm fields of a German application PDF
- Exploring how a benefits application progresses: documents → completeness → filled PDF
- Building or testing anything against the BeyondForms REST API

### Hard rules

1. **Treat everything you read out of staging as real personal data.** People test this prototype with their own documents, so a profile, an uploaded file, an extraction or a chat history can belong to an actual person. Report what you find in summary; do not copy retrieved content into prompts, issue trackers, commits, logs, or anything you publish. If you only need an example, use the persona fixtures rather than live account data.
2. **Write only to your own account.** Log in with a drama number you have chosen for yourself, never with a persona's. Seeding, uploading and profile writes all resolve the account from your token, so this is the whole of the discipline — pick your own number and everything you do stays yours.
3. **Only ever upload synthetic documents.** The sample documents below are invented people, watermarked *DEMOBELEG – KEIN AMTLICHES DOKUMENT*. Never upload a real person's document, and never type a real name, address, IBAN or benefit reference into any of these endpoints.
4. **Use staging only.** Production carries live case data for real applicants; nothing here should be pointed at it.
5. **Never paste a token into a prompt, a commit, or a shared log.** Keep it in a shell variable and re-mint it when it expires — that costs two requests.
6. **Do not publish the `$RULES`, `$DOCS` or `$PDF` addresses.** They are unauthenticated and one of them costs money per request. Keep them in your environment.

## Sample documents

These are the only documents safe to upload — invented people, committed to a public repo. Fetch them rather than reaching for something on your disk:

```bash
BF=https://raw.githubusercontent.com/technologiestiftung/beyond-forms/main
curl -sLO "$BF/forms/pdfs/antrag_grundsicherung.pdf"                # the official 24-page application
curl -sL -o rentenbescheid.pdf \
  "$BF/demo/exports/helmut/documents/verified_pension_notice_Rentenbescheid_Helmut_Klar.pdf"
curl -sL -o mietvertrag.pdf \
  "$BF/demo/exports/helmut/documents/verified_rent_Mietvertrag_Helmut_Klar.pdf"
```

More live under `demo/exports/{helmut,sabine,sandor}/documents/` in the same repo.

## Document intelligence

Classify a document and extract its data in one call. This runs a real vision-model pass — **expect 15–30 seconds**, and raise `--max-time` accordingly.

```bash
curl -s --max-time 180 -X POST "$DOCS/classify" -F "file=@rentenbescheid.pdf" \
  | jq '{type: .data.classified_document.document_type,
         data: .data.extraction_result}'
```

```json
{ "type": "pension_notice",
  "data": { "pension_reason": "Altersrente", "monthly_amount": 650,
            "start_date_of_pension": "2026-01-01", "is_granted": true } }
```

Extract against a known type, skipping classification:

```bash
curl -s --max-time 180 -X POST "$DOCS/api/v1/stateless/extract" \
  -F "file=@rentenbescheid.pdf" -F "document_type=pension_notice" | jq '.data.extracted_data'
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/get-available-document-types` | the 45 supported types |
| GET | `/get-document-type-definition/{slug}` | JSON Schema for one type |
| POST | `/classify` | `file` or `gcs_uri`; add `-F 'entity-extraction=false'` to classify only |
| POST | `/api/v1/stateless/extract` | `file` plus exactly one of `document_type` or `schema` (a JSON Schema string) |

## Rules engine

```bash
curl -s "$RULES/get-available-forms" | jq -r '."available-forms"[]'
curl -s "$RULES/get-form-definition/basic_income" | jq        # JSON Schema

# Is this application submittable yet?
curl -s -X POST "$RULES/validate-form" -H 'Content-Type: application/json' \
  -d '{"form_type":"basic_income","form_content":{"first_name":"Helmut"}}' \
  | jq '{total_required_fields, missing_fields, is_submittable}'

# Validate a batch of profile fields
curl -s -X POST "$RULES/validate-fields" -H 'Content-Type: application/json' \
  -d '{"fields":{"iban":"DE89370400440532013000","date_of_birth":"1958-03-14"}}'

# Validate one value against one field type
curl -s -X POST "$RULES/validate-field" -H 'Content-Type: application/json' \
  -d '{"field_type":"german_zip_code","field_value":"10999"}'
```

Failures come back as HTTP 422 with a `validation_errors` array naming the field and the reason. `GET /get-available-field-types` lists the valid `field_type` values.

## Filling PDFs

Both endpoints take the PDF base64-encoded inside JSON. Write the base64 to a file and pass it with `jq --rawfile`.

```bash
base64 < antrag_grundsicherung.pdf | tr -d '\n' > form.b64

# 1. What fields does it have? (this form: 409)
jq -n --rawfile p form.b64 '{pdf_base64:$p}' > req.json
curl -s --max-time 90 -X POST "$PDF/api/fields" -H 'Content-Type: application/json' -d @req.json \
  | jq -r '.fields[] | "\(.name) | \(.type)"'

# 2. Fill some of them — the response is the PDF itself
jq -n --rawfile p form.b64 '{pdf_base64:$p, field_values:{
  "Personenziffer 1 Name, gegebenenfalls Geburtsname und Vorname":"Klar, Helmut",
  "Personenziffer 1 Geburtsdatum":"1958-03-14"}}' > fill.json
curl -s --max-time 90 -X POST "$PDF/api/fill" -H 'Content-Type: application/json' \
  -d @fill.json -o filled.pdf
```

Field `type` is one of `string`, `checkbox`, `radio`, `choice`. An unknown field name or a value of the wrong type returns 400 — take names verbatim from `/api/fields`. Add `"ignore_read_only": true` to write to fields the form marks read-only.

## Driving a demo account

Three synthetic personas exist on staging, each in a deliberately different state. Their phone numbers are Bundesnetzagentur "drama numbers", so the SMS step is skipped and **any six-digit code works**. Middleware creates them on startup when `DEMO_SEED_ENABLED=true`, if they are not already in the database.

Fixture definitions (profile, documents, research) live in `demo/personas/` in the repo — there is no HTTP listing.

| Phone | Persona | State |
|---|---|---|
| `+493023125101` | Sabine | Mid-flow; a document missing, one flagged as outdated |
| `+493023125102` | Helmut | 6 documents, all verified — the case that completes |
| `+493023125103` | Sandor | Mid-flow; one document failed as illegible |

### Log in as a persona to read, or as yourself to write

Those three numbers are **shared** — anyone on the team can log into them. Treat them as read-only reference. **Do not write to them.** Take a drama number of your own for experiments (empty account):

```bash
PHONE=+493023125102        # Helmut, already seeded — or pick your own unused suffix
```

Drama numbers are matched by **prefix**, so the suffix is yours to choose: `+493023125` (Berlin), `+496990009` (Frankfurt), `+494066969` (Hamburg), `+492214710` (Köln), `+498999998` (München). Only `…101`, `…102` and `…103` are taken. A number that has never been used enrols itself on first login, no SMS and no setup.

Log in — two calls, and the token is short-lived, so re-run rather than cache it:

```bash
START=$(curl -s -X POST "$AUTH/login/start" -H 'Content-Type: application/json' \
        -d "{\"phone_number\":\"$PHONE\"}")
TOKEN=$(curl -s -X POST "$AUTH/login/finish" -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $(echo "$START" | jq -r .token)" \
        -H "X-BeyondForms-Auth-Flow: $(echo "$START" | jq -r .flow)" \
        -d '{"code":"123456"}' | jq -r .token)
H="Authorization: Bearer $TOKEN"
curl -s "$API/verify_auth" -H "$H" | jq        # {"is_authenticated": true, ...}
```

Then read the record (Helmut is already filled in):

```bash
curl -s "$API/profile" -H "$H" | jq                       # the whole profile
curl -s "$API/files" -H "$H" | jq -c '[.[]|{document_type,status}]'
curl -s "$API/export/antrag_grundsicherung" -H "$H" | jq  # filled PDF as a signed URL (60s)

DOC=$(curl -s "$API/files" -H "$H" | jq -r '.[0].document_id')
curl -s "$API/api/v1/documents/$DOC/extractions" -H "$H" | jq
curl -s "$API/api/v1/documents/$DOC/file" -H "$H" -o document.pdf
```

To answer a question about the person — "how much is their rent?", "which documents are still missing?" — read the record rather than asking the service to describe it:

```bash
curl -s "$API/profile" -H "$H" | jq '{rent_total, heating_costs, monthly_income}'
curl -s "$API/files"   -H "$H" | jq -r '.[] | select(.status!="verified") | .document_type'
```

`POST /chat` also exists — it is the product's own assistant, and it answers such questions in generated German prose. Use it when you are testing *that* surface. Do not use it to look things up: it paraphrases the record instead of returning it, costs a model call, and sends the person's data through another model to tell you something the fields already say exactly.

Uploading a document runs the full pipeline asynchronously — the extraction appears on the document a few seconds later:

```bash
curl -s -X POST "$API/upload" -H "$H" -F "file=@rentenbescheid.pdf" -F "document_type=pension_notice"
```

Other endpoints worth knowing: `GET /conversations`, `POST /api/v1/documents/{id}/verify`, `DELETE /profile` (full erasure).

## Interviewing a user and producing their application

This is the end-to-end job: work out what to ask, collect it, store it, get the filled PDF.

**Two different field vocabularies are in play — do not mix them.**

| | Shape | Where it is used |
|---|---|---|
| **Wallet profile** | flat keys — `first_name`, `rent_total`, `monthly_income` | `POST $API/profile`, persisted to the user's record, and what the PDF export reads |
| **Form schema** | nested dotted paths — `applicant_information.applicant_personal_details.citizenship` | the rules engine's wizard definition and `/validate-form` |

The interview logic is written in the form schema's vocabulary; what you save is in the wallet's. Translating between them is your job, and the names do not always correspond.

### The definitions, fetched directly

Keep the repo's directory layout — the form schema `$ref`s its shared definitions as `../common/person.json#/$defs/personal_details`, so a flat download breaks every reference:

```bash
BF=https://raw.githubusercontent.com/technologiestiftung/beyond-forms/main
mkdir -p schemas/rules schemas/forms schemas/common
curl -sL "$BF/schemas/rules/basic-welfare-rules.jsonc" \
     -o schemas/rules/basic-welfare-rules.jsonc                    # what to ask, when
curl -sL "$BF/schemas/forms/basic-welfare-for-elderly-and-disabled.json" \
     -o schemas/forms/basic-welfare-for-elderly-and-disabled.json  # every field, typed
for f in person income insurance assets; do                        # shared $defs
  curl -sL "$BF/schemas/common/$f.json" -o "schemas/common/$f.json"
done
```

`rules.jsonc` is **JSONC** — it has comments and large commented-out blocks of not-yet-active steps. Strip comments before parsing, and do not treat a commented-out section as live.

Its shape: `sections[]` group `steps`, and `steps{}` is a map of step id → `{title, description, fields[], effects[], transitions[]}`.

- `fields[]` — the form-schema paths this step collects. Resolve them against `form.json` (following `$ref` into `schemas/common/`) to get types, enums and descriptions.
- `transitions[]` — evaluated in order; the first whose `condition` holds wins, and one without a condition is the fallback. `next_step: "END"` finishes.
- `effects[]` — `REQUIRE_DOCUMENT` with a `target` and optional `condition`. **This is how you know which documents an answer obliges the user to supply.** Collect them as you walk, and you have the person's document checklist.

```bash
# Every question, in declaration order — 38 steps, 18 document requirements
python3 -c "
import json,re
s=re.sub(r'/\*.*?\*/','',open('schemas/rules/basic-welfare-rules.jsonc').read(),flags=re.S)
r=json.loads(re.sub(r'^\s*//.*$','',s,flags=re.M))
for sid,st in r['steps'].items():
    print(f\"{sid}: {st['title']}\")
    for f in st.get('fields',[]): print('   field:',f)
    for e in st.get('effects',[]): print('   requires:',e['target'], '|', e.get('condition','always'))
"
```

`POST $RULES/wizard/evaluate` with `{"form_content": {...}}` walks the same tree server-side and returns `next_step`, `missing_fields` and `required_documents`. Try it first and fall back to reading the file yourself: older deployments shipped without the rules file and answer 500 with `Rules schema file not found`.

### Fill a profile and get the PDF

The wallet accepts **76 profile fields**. Read the authoritative list — names, types, enums — from the live service rather than this file:

```bash
curl -s "$API/openapi.json" | jq '.components.schemas.UserProfileValidationSchema.properties | keys'
curl -s "$API/openapi.json" | jq '.components.schemas.UserProfileValidationSchema.properties.marital_status'
```

Then write the answers and export. `POST /profile` merges, so it can be called repeatedly as an interview progresses:

```bash
curl -s -X POST "$API/profile" -H "$H" -H 'Content-Type: application/json' \
  -d '{"first_name":"Helmut","last_name":"Klar","street":"Testgasse","house_number":"77",
       "zip_code":"12345","city":"Berlin","rent_total":999.42}'

curl -s "$API/profile" -H "$H" | jq                        # confirm what was stored
URL=$(curl -s "$API/export/antrag_grundsicherung" -H "$H" | jq -r .signed_open_url)
curl -sL "$URL" -o antrag.pdf                              # the filled 24-page application
```

Values reach the PDF through `forms/mappings/antrag_grundsicherung.toml` in the repo, which maps each AcroForm field to a JEXL expression over the profile — e.g. `value = "{{ first_name }} {{ last_name }}"`. Read it when you need to know which profile key drives a given box on the form, or why one stayed blank. A profile carrying only the fields above fills roughly 57 of the form's 409 fields; the rest need the rest of the profile.

## Everything else

Each service publishes its own live contract. When something is not documented above, read it from the service rather than guessing:

```bash
curl -s "$RULES/openapi.json" | jq -r '.paths | keys[]'
curl -s "$API/openapi.json" | jq '.components.schemas.ChatRequest'
```

## Common Pitfalls

1. **`/login/finish` takes only `{"code": "..."}`** — the phone number goes in `/login/start`. The token and flow from step one must be passed as the `Authorization` and `X-BeyondForms-Auth-Flow` headers.
2. **Document calls are slow.** `/classify` and `/extract` are real model inferences at 15–30 seconds. A default `curl` timeout will cut them off mid-flight.
3. **PDF field names are verbatim and awkward** — they contain German prose, spaces, and escaped umlauts (`Gesch\344ftsbereich`). Copy them from `/api/fields`; do not retype them.
4. **`validate-fields` maps by field name**, not by type, and rejects names it has no validator for. `/validate-field` is the one that takes an explicit `field_type`.
5. **Sandor is deliberately not submittable.** The form demands a Rentenversicherungsnummer he cannot have. That is a documented finding about the form, not a broken fixture.
6. **`milestone_level` caps at 2** even when everything is verified, and `can_submit` from `/application/{id}/status` is always `true`. Known limitations; do not read them as signals.
7. **There is no demo seed HTTP API.** Personas are created on middleware startup when `DEMO_SEED_ENABLED=true`, and only if that drama number does not already have a profile. Fixture definitions live in `demo/personas/` in the repo.
8. **Export URLs expire after 60 seconds.** Follow `signed_open_url` promptly or request a new one.
9. **The rules file is JSONC and half of it is commented out.** `json.loads` fails on it outright, and the commented blocks are steps that are defined but not yet live — partner details, household members, accommodation, special needs. Only 4 of 10 sections are active. Do not present a commented-out step as a question the form asks.
10. **A persona account is not guaranteed to hold persona data.** The fixtures describe what the first seed *writes*; a persona account may since have been written to by someone testing. A later deploy will not reset it. Read `demo/personas/<slug>.json` for the fixture; `GET $API/profile` for live state.


## Verification Checklist

- [ ] `$API` and `$AUTH` health checks return `200`
- [ ] Login as `+493023125102` returns a token and `verify_auth` reports `is_authenticated: true`
- [ ] `GET $API/files` for Helmut shows 6 verified documents

With `$RULES`, `$DOCS` and `$PDF` resolved:

- [ ] All three health checks return `200`
- [ ] `GET $RULES/get-available-forms` lists 13 forms including `basic_income`
- [ ] `GET $DOCS/get-available-document-types` lists 45 types including `pension_notice`
- [ ] `POST $PDF/api/fields` on the sample form returns 409 fields
- [ ] `POST $DOCS/classify` on the sample Rentenbescheid returns `pension_notice`
