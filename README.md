# ORCA UI Authentication
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

The app is served at `https://orca-infer.ai/ui/`. Its root authentication gate
initializes Keycloak in the browser with `onLoad: "login-required"` and PKCE S256.
Unauthenticated users are automatically redirected to Keycloak, then returned to
their current UI route. Protected route components are not rendered during SSR
or while sign-in is pending. Tokens remain in Keycloak's in-memory client; they
are not saved to localStorage.

## Keycloak Client

In your realm, create an OpenID Connect client with these settings:

- Client ID: `orca-client` (or your existing client ID).
- Client authentication: Off (public browser client; no client secret).
- Standard flow: On.
- Implicit flow and direct access grants: Off unless another application needs them.
- PKCE code challenge method: `S256`.
- Valid redirect URIs: `https://orca-infer.ai/ui` and `https://orca-infer.ai/ui/*`.
- Web origins: `https://orca-infer.ai` (no path and no wildcard).

For local development, add `http://localhost:8080/ui/*` to valid redirect URIs
and `http://localhost:8080` to web origins. Visit `http://localhost:8080/ui/`.

## Deployment Configuration

These public environment variables default in the server code and can be
overridden in the app's runtime environment, such as the Kubernetes Deployment:

```dotenv
VITE_KEYCLOAK_ENABLED=true
VITE_KEYCLOAK_URL=https://orca-infer.ai/auth
VITE_KEYCLOAK_REALM=orca
VITE_KEYCLOAK_CLIENT_ID=orca-client
```

The app fetches these values from its same-origin runtime-config endpoint when
it starts, so changing the deployed container's environment does not require a
new image build. Never put secrets in `VITE_*` variables; these settings are
sent to the browser. Authentication is enabled by default and
`VITE_KEYCLOAK_ENABLED=false` explicitly bypasses the UI gate for local
development only.

The Keycloak URL must match the path exposed by your gateway. This deployment
routes `/auth` to Keycloak, so its realm discovery endpoint must be reachable at
`https://orca-infer.ai/auth/realms/orca/.well-known/openid-configuration` and
advertise public HTTPS authorization and token endpoints. Configure Keycloak to
serve under `/auth`, or configure the gateway to rewrite `/auth` to `/` when
forwarding to a Keycloak instance serving at its default root path.

Configure your ingress to route `/ui` to this app and `/auth` to Keycloak.
If visitors should enter at `https://orca-infer.ai/`, configure a root redirect
to `/ui/` in your ingress. The app's router currently uses `/ui` as its base.

## Security And Verification

This is a browser UI gate, not API authorization. The RAG proxy routes and server
functions still require server-side authentication before production access can
be considered protected. For bearer-token authorization, send an access token
with requests and validate its signature (using the realm JWKS), issuer,
audience, expiry and required permissions on the server. Do not trust decoded
tokens without verification. No API authorization was added by this UI setup.

After deployment, open `/ui/` in a private browser window, verify the redirect
goes to `/auth/realms/orca/protocol/openid-connect/auth`, complete sign-in,
and verify you return to `/ui/` (or the product route you opened). Test a reload
and a session expiry as well. A successful build cannot verify the deployed
realm, ingress, redirect URI allowlist or login credentials.
