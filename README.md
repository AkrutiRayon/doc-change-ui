# Doc Change UI

A Tanstack React Router + React Start application for AI-powered documentation and code change search.

## Development Setup

### Prerequisites
- Node.js (v18+)
- Bun or npm

### Environment Configuration

For development, you need to configure the RAG API base URL using the `.dev.vars` file (loaded by Nitro):

1. **Copy the environment template:**
   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. **Edit `.dev.vars` and set the RAG API URL:**
   ```env
   RAG_BASE_URL=infer.hawk-llm.ai
   ```

   The `RAG_BASE_URL` should be just the hostname (e.g., `infer.hawk-llm.ai`) without the protocol or trailing slash. The application will automatically construct the full URLs for API endpoints.

3. **Important**: After creating or editing `.dev.vars`, you **must restart the dev server** for changes to take effect.

### Running Locally

```bash
# Install dependencies
bun install

# Start the development server
bun dev
```

The application will be available at `http://localhost:8080`.

## Features

- **Standard Mode**: Change monitoring with optional timeframe filtering (defaults to last 30 days)
- **Direct Mode**: Direct questions without time constraints
- **Calendar Date Picker**: Easy date range selection for standard searches
- **Document Generation**: Export search results as markdown documents

## API Integration

The application proxies RAG API requests through the server to avoid CORS issues. All API calls are made server-side.

### Request Payload Structure

**Standard Search (with timeframe):**
```json
{
  "query_text": "What changed in helm-crane?",
  "repo_id": "github.com/Blazemeter/helm-crane",
  "type": "standard",
  "limit": 15,
  "from_date": "2026-07-14",
  "to_date": "2026-08-13"
}
```

**Standard Search (without timeframe - backend defaults to last 30 days):**
```json
{
  "query_text": "What changed in helm-crane?",
  "repo_id": "github.com/Blazemeter/helm-crane",
  "type": "standard",
  "limit": 15
}
```

**Direct Search (no timeframe):**
```json
{
  "query_text": "Is gatling 3.19 supported?",
  "repo_id": "github.com/Blazemeter/taurus",
  "type": "direct",
  "limit": 15
}
```

**Note**: When using Standard mode without selecting dates, the `from_date` and `to_date` fields are omitted from the request. The backend will handle defaulting to the last 30 days.

