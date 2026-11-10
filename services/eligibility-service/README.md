# Eligibility Service

Runs the knowledge base in `/knowledge` with `libs/eligibility-engine` for callers that are not the browser, mainly the chat agent of the orchestration service. It keeps no state: every request carries the profile in the shape of `GET /profile`.

| Endpoint | Returns |
|---|---|
| `GET /health` | `{ "status": "ok" }` |
| `GET /applications?lang=de` | The forms the knowledge base can guide through |
| `POST /eligibility` `{ profile, lang }` | Status and reasons per benefit, and the next question of the eligibility check |
| `POST /applications/{form_type}/progress` `{ profile, lang }` | Whether the form is complete, invalid answers, and the next field with its question and storage column |

```bash
npm start      # port 8090, or $PORT
npm test
```

The engine's dependencies are installed in `libs/eligibility-engine` (`npm ci` there); this service has none of its own. `KNOWLEDGE_DIR` overrides where the Turtle files are read from.
