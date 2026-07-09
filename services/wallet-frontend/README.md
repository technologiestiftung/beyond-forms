# Wallet Frontend

The Wallet Frontend is the primary user-facing web application for BeyondForms. It allows citizens to interact with the system, chat with the AI assistant, manage their digital "wallet" of extracted documents, and review auto-filled forms.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **State Management**: Zustand
- **Data Fetching**: React Query (@tanstack/react-query)
- **Forms & Validation**: React Hook Form with Zod

## Prerequisites

The frontend relies heavily on two backend services being available:

- **Auth Service**: For user authentication and session management.
- **Orchestration Middleware Service**: For chat, document intelligence, rules validation, and form filling APIs.

Make sure you have set up the `.env` files and started the backend services via Docker Compose before running the frontend locally.

## Local Development

### 1. Environment Setup

Create a `.env.local` file in the `services/wallet-frontend` directory. The application requires API proxy URLs to communicate with the backend:

```bash
# If running standalone, proxy requests to your local docker-compose backend
VITE_AUTH_PROXY_URL=http://localhost:8003
VITE_API_PROXY_URL=http://localhost:8080
```

_(Note: If you run this service via Docker Compose, these variables are injected automatically via the `compose.yaml` file.)_

### 2. Installation & Run

You can run the frontend standalone on your host machine for faster iteration:

```bash
cd services/wallet-frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

### 3. Scripts

- `npm run dev`: Starts the local development server with Hot Module Replacement (HMR).
- `npm run build`: Compiles TypeScript and builds the app for production.
- `npm run lint`: Runs ESLint to check for code style and potential errors.
- `npm run preview`: Locally previews the production build.
- `npm test`: Runs the Vitest test suite.
