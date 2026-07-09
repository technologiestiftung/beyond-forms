# Middleware Orchestration API

The Middleware "Orchestration" API serves as the central hub for our document processing ecosystem. This service will act as the "glue" between our distributed internal services and the LLM.

## Core Responsibilities

The middleware will eventually manage the lifecycle of a user request by coordinating with:

- **Document Intelligence Service**: For OCR and data extraction.
- **Form Filler Service**: For automated document completion.
- **Rule Engine Service**: For logic validation and business rules.
- **LLM Service**: For intent classification, function calling and general chat functionality.

## Key Features

- **Authentication & Identity**: User registration and JWT/Session management.
- **LLM Proxying**: Forwarding prompts to the LLM and enriching context with retrieved metadata.
- **Profile & State Management**: Handling user profile data and session history.
- **File Handling**: Secure endpoints for document uploads and retrieval of processed forms.
- **Automated Form Export**: Generate filled PDF documents from user profile data using JEXL-based mappings.

## API Endpoints

### Authentication

To access protected endpoints, you must authenticate via the Authentication Service (locally if using Docker Compose).

- **Login Start**: `http://localhost:8003/login/start`
- **Login Finish**: `http://localhost:8003/login/finish`

### User Profile

#### `GET /profile`

Retrieve the current user's profile.

- **Requires Authentication**: Yes

#### `POST /profile`

Update the user's profile data after validation by the Rules Engine.

- **Requires Authentication**: Yes
- **Example Request Body**:

```json
{
  "first_name": "Jane",
  "last_name": "Mustermann",
  "date_of_birth": "1990-05-15",
  "place_of_birth": "Berlin",
  "legal_gender": "Female",
  "is_german_citizen": true
}
```

- **Response**: Returns the validation result from the Rules Engine. If the status is `"success"`, the data is persisted to the database.

### Form Export

#### `GET /export/{form_type}`

Generates a filled PDF for the specified form type using the current user's profile data.

- **Requires Authentication**: Yes
- **Supported Form Types**: Currently includes `test_form` and `antrag_bewohnerparkausweis_barrierefrei-ts`.
- **Logic**: Uses TOML mapping files. Expressions wrapped in `{{ }}` are evaluated using JEXL.

## Development

### Run Locally

Ensure you have copied the `.env.template` to `.env` inside this folder and that the dependencies (like PostgreSQL and the Pub/Sub emulator) are running via Docker Compose.

```bash
cd services/orchestration-middleware-service
uv run fastapi dev src/main.py --port 8080
```

### Run Tests

```bash
uv run pytest
```

### Running Load Tests

To execute the Locust load tests against the orchestration middleware service:

1. Ensure the docker containers are running:
   ```bash
   docker compose up -d
   ```
2. Run the headless verification pipeline script:
   ```bash
   ./services/orchestration-middleware-service/tests/load/run_load_test.sh http://localhost:8080
   ```
3. Or run interactively using the Locust Web GUI:
   ```bash
   cd services/orchestration-middleware-service
   uv run locust -f tests/load/locustfile.py -H http://localhost:8080
   ```
   Then open [http://localhost:8089](http://localhost:8089) in your browser.

### Automatically generate data models from the database locally

```bash
uv run sqlacodegen postgresql://devuser:devpassword@localhost:5432/devdb > src/models.py
```
