# ORCA UI Authentication

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
