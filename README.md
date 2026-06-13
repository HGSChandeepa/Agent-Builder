# AI Agent Builder

Visual workflow builder for designing, simulating, and executing AI agent pipelines. Agents are composed as directed graphs of nodes on a canvas, persisted to PostgreSQL, and run through a plugin-based execution engine with governance controls, LLM integration, and third-party connectors.

## Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Framework | Next.js (App Router) | 16.x |
| UI | React, Tailwind CSS, Base UI, XYFlow | React 19 |
| State | Zustand | 5.x |
| Database | PostgreSQL via Prisma ORM | Prisma 7 |
| LLM Provider | Groq SDK | 1.x |
| Language | TypeScript | 5.x |

## Architecture

The application is split into a Next.js frontend, API route handlers, and a core execution platform under `src/`.

| Directory | Responsibility |
| --- | --- |
| `app/` | Next.js pages and REST API route handlers |
| `app/builder/[id]/` | Visual workflow editor for a single agent |
| `app/integrations/` | Integration connection management UI |
| `src/core/execution/` | Workflow run engine, retry logic, run persistence |
| `src/core/nodes/` | Node plugin registry and built-in node implementations |
| `src/core/workflow/` | Agent graph types, validation, repository |
| `src/features/` | UI feature modules (agent hub, builder, integrations, run inspector) |
| `src/integrations/` | OAuth providers, connector gateway, activity logging |
| `src/security/` | Secrets vault, policy engine, audit trail |
| `prisma/` | Database schema and migrations |
| `generated/prisma/` | Generated Prisma client (not committed) |

### Execution Flow

1. An agent workflow is stored as `nodes` and `edges` JSON on the `Agent` record.
2. A run is triggered via `POST /api/runs` (live) or simulation mode from the builder UI.
3. The execution engine topologically sorts nodes and invokes each registered plugin in order.
4. Step outputs, logs, metrics, traces, and approval requests are persisted on `WorkflowRun`.
5. Mutating nodes (CRM writes, Gmail send) can pause execution until human approval.

## Features

| Feature | Description |
| --- | --- |
| Agent Hub | Create, browse, and open agent workflows from the home page |
| Visual Builder | Drag-and-drop node canvas with property panel and category palette |
| Simulation Mode | Dry-run workflows without live API calls or token usage |
| Run Inspector | Inspect step-by-step execution output, logs, and approval state |
| LLM Calls | Groq-backed chat completions with structured JSON output support |
| Governance | Approval gates, policy checks (PII, payload size), and audit logging |
| Integrations | OAuth-based third-party connections with encrypted token storage |
| Gmail Node | Unified node for send, read, and inbox monitor actions |

## Node Types

| Type | Category | Description |
| --- | --- | --- |
| `ManualTrigger` | trigger | Start a workflow manually from the UI |
| `HttpRequest` | data | REST/GraphQL requests to external APIs |
| `SqlQuery` | data | Parameterized SQL queries against a configured connection |
| `PromptTemplate` | ai | Compose system and user prompts with `{{variable}}` substitution |
| `LlmCall` | ai | Call a Groq language model; supports text and JSON output |
| `IfElse` | control | Branch on field comparisons (equals, contains, gt, lt) |
| `ForEach` | control | Iterate over an array field from upstream output |
| `RetryWithBackoff` | control | Attach retry policy metadata to downstream execution |
| `Transform` | output | Map upstream fields to a new output shape |
| `ReturnResponse` | output | Define the final workflow response payload |
| `LlmOutput` | output | Surface the final LLM message as workflow output |
| `EmitMetric` | output | Record custom telemetry metrics on a run |
| `CreateOrUpdateRecord` | action | Create or update CRM/ticket records (requires approval in production) |
| `Gmail` | action | Send, read, or monitor Gmail via a connected OAuth account |
| `ApprovalGate` | governance | Require human approval before continuing |
| `PolicyCheck` | governance | Validate payloads against PII and size policies |

## Integrations

| Provider | Status | Capabilities |
| --- | --- | --- |
| Gmail | Available | OAuth 2.0 connect, inbox monitoring, read/send, activity logging |
| Outlook | Coming soon | Inbox monitoring and outbound mail |
| Slack | Coming soon | Channel messages and event triggers |
| Microsoft Teams | Coming soon | Channel notifications |
| Google Drive | Coming soon | File read/write |
| Notion | Coming soon | Page and database access |
| HubSpot | Coming soon | CRM record sync |

### Gmail OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the Gmail API.
3. Configure an OAuth 2.0 Web client with the redirect URI from the environment table below.
4. Copy the client ID and secret into `.env`.
5. Open `/integrations` and connect a Gmail account.

Required OAuth scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`, `userinfo.email`, `openid`.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`?sslmode=require` for hosted providers) |
| `GROQ_API_KEY` | For live LLM runs | API key from [Groq Console](https://console.groq.com/) |
| `GOOGLE_CLIENT_ID` | For Gmail | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | For Gmail | OAuth 2.0 client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | For Gmail | Callback URL; default `http://localhost:3000/api/integrations/oauth/gmail/callback` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL used to build OAuth redirect URIs |
| `INTEGRATION_TOKEN_SECRET` | For Gmail | 32-byte secret for encrypting stored OAuth tokens |

Generate `INTEGRATION_TOKEN_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Getting Started

### Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js | 20 or later recommended |
| PostgreSQL | Local instance or hosted (e.g. Neon) |
| npm | Comes with Node.js |

### Installation

```bash
git clone <repository-url>
cd builder
npm install
cp .env.example .env
# Edit .env with your values
npm run db:generate
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the Agent Hub.

### NPM Scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `npm run dev` | Start Next.js development server |
| `build` | `npm run build` | Production build |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | Run ESLint |
| `db:generate` | `npm run db:generate` | Generate Prisma client |
| `db:migrate` | `npm run db:migrate` | Apply database migrations (development) |
| `db:push` | `npm run db:push` | Push schema changes without migration files |

## Database Schema

| Model | Table | Purpose |
| --- | --- | --- |
| `Agent` | `agents` | Workflow definition (nodes, edges, integrations JSON) |
| `WorkflowRun` | `workflow_runs` | Execution snapshots with step runs, metrics, and approvals |
| `IntegrationConnection` | `integration_connections` | OAuth connections with encrypted tokens |
| `IntegrationActivityLog` | `integration_activity_logs` | Per-connection action audit trail |

Agent environments: `development`, `staging`, `production`.  
Agent statuses: `draft`, `published`, `archived`.

## Security Notes

- OAuth access and refresh tokens are encrypted at rest using `INTEGRATION_TOKEN_SECRET`.
- Never commit `.env` or real credentials. Only `.env.example` is tracked as a template.
- Mutating workflow steps require explicit approval outside development and simulation modes.
- Policy check nodes can block payloads containing detected PII or exceeding size limits.

## License

Private project.
