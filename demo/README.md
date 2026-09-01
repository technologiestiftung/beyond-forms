# Demo personas

Prefilled BeyondForms accounts — profile **and** verified documents — so an experiment can
start from a realistic case instead of an empty form. Seeding skips the document-intelligence
pipeline entirely: extractions are reviewed fixtures, so there is no Gemini call, no Pub/Sub
publish, and no waiting.

| | Sabine | Helmut | Sandor |
|---|---|---|---|
| | <img src="personas/portraits/Sabine.png" width="180"> | <img src="personas/portraits/Helmut.png" width="180"> | <img src="personas/portraits/Sandor.png" width="180"> |
| **Phone** | `+493023125101` | `+493023125102` | `+493023125103` |
| **Case** | Volle Erwerbsminderung, single, 1-person household, Mitte | Grundsicherung im Alter, married, 2-person household, Charlottenburg-Wilmersdorf | Asylberechtigt, non-German, single, long-term recipient, Neukölln |
| **State** | Mid-flow — 4 documents, Rentenbescheid **missing**, Kontoauszug flagged as an old statement | 6 documents, **all real scans, all verified** | Mid-flow — 4 documents, Nebenkostenabrechnung **failed as illegible**, Kontoauszug missing pages, Heizkosten never uploaded |
| **Use it for** | To-do handling, encouragement copy, cognitive load, "I can't find this document" | Final review, completeness milestones, PDF export — the case that works | Upload quality feedback, error copy, the KdU/housing-cost flow, multilingual surfaces |
| **Source** | [01_sabine.md](research/01_sabine.md) | [02_helmut.md](research/02_helmut.md) | [03_sandor.md](research/03_sandor.md) |

The three deliberately land in **different** states. If they all looked complete they would
stop exercising the review and to-do paths, which is most of what there is to study.

## Seed them

When `DEMO_SEED_ENABLED=true` (the compose default, and every deployed environment),
middleware startup inserts any persona whose drama number does not already have a
profile. Existing profiles are left alone.

```bash
docker compose up -d                         # seeds Sabine, Helmut, Sandor on first boot
./scripts/seed_demo_personas.sh              # same check, from inside the container
./scripts/seed_demo_personas.sh helmut       # force-reset one
```

Document blobs go to a local [fake-gcs-server](https://github.com/fsouza/fake-gcs-server)
emulator (`gcs-emulator` in `compose.yaml`), not the real bucket — no `gcloud auth
application-default login` needed for seeding or export. Unset `STORAGE_EMULATOR_HOST` to
point at the real `beyondforms-dev-bucket` instead (needs ADC). Chat, document-intelligence
OCR and RAG still call Vertex AI directly and always need real credentials — the emulator
only covers document storage.

Then log into the wallet frontend on <http://localhost:3000> with any of the phone numbers.
They are Bundesnetzagentur "drama numbers", which bypass the SMS one-time password, so any
code works.

## Give this to your team

Staging and production both have `DEMO_SEED_ENABLED=true`, so the first middleware
revision that boots against an empty database creates Helmut, Sabine and Sandor.
Later deploys skip them if those accounts already have a profile. Treat the three
numbers as shared reference — log in as one of them to *read* the case, and take a
drama number of your own (any unused suffix) if you need a private empty account.

```bash
API=https://staging.bf.citylab-berlin.org/api            # middleware
AUTH=https://staging.bf.citylab-berlin.org/auth-proxy    # auth-service

# Log in as Helmut (already seeded on deploy) and read the record.
PHONE=+493023125102
START=$(curl -s -X POST $AUTH/login/start -H 'Content-Type: application/json' \
        -d "{\"phone_number\": \"$PHONE\"}")
TOKEN=$(curl -s -X POST $AUTH/login/finish -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $(echo "$START" | jq -r .token)" \
        -H "X-BeyondForms-Auth-Flow: $(echo "$START" | jq -r .flow)" \
        -d '{"code":"123456"}' | jq -r .token)

curl -s $API/profile -H "Authorization: Bearer $TOKEN" | jq
curl -s $API/files -H "Authorization: Bearer $TOKEN" | jq
```

The fixture *definitions* live in `demo/personas/` in the repo. The accounts behind
those three numbers are live state and can drift once someone writes to them; a
deploy will not reset them.

## Get a token

```bash
TOKEN=$(./scripts/demo_token.sh +493023125102)
./scripts/demo_token.sh --all                 # phone/persona/token table
```

Tokens are short-lived Authentik ID tokens. There is deliberately no long-lived static
credential — re-running the script is two curls and no SMS.

## Drive an account over the API

```bash
API=http://localhost:8080
TOKEN=$(./scripts/demo_token.sh +493023125102)
AUTH="Authorization: Bearer $TOKEN"

curl -s $API/verify_auth -H "$AUTH" | jq                    # who am I
curl -s $API/profile -H "$AUTH" | jq                        # the whole users row
curl -s $API/files -H "$AUTH" | jq                          # documents + status

DOC=$(curl -s $API/files -H "$AUTH" | jq -r '.[0].document_id')
curl -s $API/api/v1/documents/$DOC/extractions -H "$AUTH" | jq   # raw_data as the review UI sees it
curl -s $API/api/v1/documents/$DOC/file -H "$AUTH" -o document.pdf

curl -s $API/export/antrag_grundsicherung -H "$AUTH" | jq   # filled PDF, signed URL

curl -s -X POST $API/chat -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"content":"Wie hoch ist meine Miete laut meinem Profil?"}' | jq -r .content
```

Full interactive reference: <http://localhost:8080/docs>. There is no HTTP seed API —
personas are created on middleware startup when `DEMO_SEED_ENABLED=true`.

## Reading a persona file

`personas/<slug>.json`, validated by [persona.schema.json](persona.schema.json) and by
`tests/test_demo_personas.py` in the middleware — which runs in the Docker `test` stage, so a
drifted fixture fails the image build.

- `profile` — keys are `users` column names, values are the exact DB enum strings.
- `documents[].document_type` — a **frontend slot id** (`id_card`, `rent`, `stmt3`), as
  `src/worker.py` writes. Not a document-intelligence registry name.
- `documents[].raw_data` — validated against the registry schema for that slot with
  `extra="forbid"`, i.e. the same check the rules engine applies when a real user
  re-verifies a document. Computed fields such as `health_insurance_proof.is_private` must
  not appear.
- `derived` — profile keys **invented** to satisfy the schema rather than taken from the
  research document. Read this before quoting a number as a research finding.
- `missing_documents` — every slot the persona does *not* have, with a reason:
  `deliberate` (the absence is the point — do not "fix" it), `not_applicable` (this person
  would never be asked), or `not_yet_supplied` (fair game to author). A test asserts every
  absent slot is accounted for, so a forgotten document cannot hide among the intentional
  ones.
- `research` — narrative the seeder ignores: barriers, wishes, usage context, and the
  facts the schema cannot hold.

Adding a fourth persona is one JSON file plus a drama number; nothing needs registering.
A restart (or `./scripts/seed_demo_personas.sh`) will pick it up if `DEMO_SEED_ENABLED=true`.

## Seeing what comes out

```bash
./scripts/export_demo_pdfs.sh
```

Writes each persona's filled application and all of its document blobs to
[exports/](exports/) for review. See [exports/README.md](exports/README.md).

## Conventions and known limitations

**Warm rent.** The research gives Warmmieten. `rent_total` holds the **gross (warm) rent**,
with `heating_costs` and `hot_water_costs` recording the components *contained within* it,
because the KdU rules need them itemised. The column name is ambiguous about this — filed.

**Document blobs.** Helmut's profile is read directly off his six real committed scans
(Personalausweis, Mietvertrag, Rentenbescheid, Kontoauszug, Heizkostenabrechnung,
Versicherungsbescheinigung) — no generation, no invented figures. Sabine and Sandor have no
matching scans, so their documents are watermarked one-page PDFs generated from the
persona's own `raw_data`. Resolution order comes from `DEMO_ASSETS_PATH`; see
[assets/README.md](assets/README.md). Generated assets are always PDFs regardless of what
`display_name` suggests — a persona documenting a phone photo as `.jpg` would otherwise
produce an unopenable file.

**`milestone_level` from `GET /application/{id}/status` caps at 2**, however many documents
are verified. `/validate-form` never returns `required_documents`, so `application.py` falls
back to a hardcoded uppercase `["ID_CARD"]` that never matches the lowercase slot ids
actually stored. `can_submit` from that endpoint is likewise always `true`. The frontend
computes its own milestone client-side and is unaffected. Filed, not papered over — the seed
response reports both numbers.

**Facts the schema cannot hold.** Each persona's `research.not_representable` lists them.
Across the three: household-member income (Helmut is a couple — his €450 plus his wife's
€320, but `users` has a single `monthly_income` scalar), insurance costs (€120 and €290, even
though Helmut's User Story 9 is specifically about insurance being coverable), decentralised
hot-water supply, and duration of benefit receipt beyond free text. All filed as gaps.

**Prior benefit receipt.** All three personas are prior recipients, which used to make every
one of them un-submittable: the rules engine requires `previous_benefits_end_date` whenever
`has_received_benefits_before` is true, and `mappers.py` never emitted it. Now parsed from
the free-text `previous_benefits_period` — a real date column is still the right fix.

**Sandor is deliberately not submittable, and the reason is a finding.** `/validate-form`
requires `pension_insurance_provider` and `pension_insurance_number` unconditionally, but a
60-year-old asylberechtigter man who has never contributed to the German pension system has
neither — the form demands a Rentenversicherungsnummer that cannot exist. Sabine and Helmut
both come back submittable, so this is specific to his case, not a seeding failure.

**Official Anlagen exist for the biggest missing_documents gaps, but the middleware only
fills the main `antrag_grundsicherung` form.** `schemas/pdfs/` has the real attachments:
Anlage 1 (Unterhalt/maintenance), Anlage 2 (Ausländer/Asylbewerber — exactly Sandor's case),
Anlage 3 (Grundvermögen/real estate assets), Anlage 6 (Mietschulden/rent arrears). Wiring one
up means a new `forms/mappings/anlage_N.toml`, a `["form_type", ...]`-keyed export, and a
`GET /export/{form_type}` call per attachment — worth doing, not attempted here.

**The Social Worker persona is not here.** [04_social_worker.md](research/04_social_worker.md)
is committed as research context, but there is no schema behind it: no roles, no consent, no
audit log, no multi-tenancy anywhere in `migrations/`. Isolation is per-user row filtering
applied ad hoc in each route. Consent-based assist access is the most-repeated requirement
across all four research documents and the largest thing that is researched but unbuilt.
The co-use scenario the documents describe is partly reachable today, since worker and client
share one session — `./scripts/demo_token.sh --all` gives one operator all three at once.

## Re-seed one account

```bash
docker compose exec orchestration-middleware-service python -m src.demo_cli --ensure
docker compose exec orchestration-middleware-service python -m src.demo_cli +493023125102 helmut --reset
```

`--ensure` is the same check middleware runs on startup. `--reset` rewrites one account.
A `users` row is created if missing; `authentik_id` stays null until first login.

## Everything here is synthetic

Names, addresses, IBANs, insurance numbers and tax IDs are invented. The portraits are
generated likenesses, used in documentation only — never written to the database or served as
a document. Generated PDFs are watermarked *DEMOBELEG – KEIN AMTLICHES DOKUMENT*. No real
citizen data belongs in these files.
