# ORCA UI Authentication

The app is served at `https://orca-infer.ai/ui/`. Its root authentication gate
initializes Keycloak in the browser with `onLoad: "login-required"` and PKCE S256.
Unauthenticated users are automatically redirected to Keycloak, then returned to
their current UI route. Protected route components are not rendered during SSR
or while sign-in is pending. Tokens remain in Keycloak's in-memory client; they
are not saved to localStorage.

## Keycloak Client

In your realm, create an OpenID Connect client with these settings:

- Client ID: `orca-ui` (or your existing client ID).
- Client authentication: Off (public browser client; no client secret).
- Standard flow: On.
- Implicit flow and direct access grants: Off unless another application needs them.
- PKCE code challenge method: `S256`.
- Valid redirect URIs: `https://orca-infer.ai/ui` and `https://orca-infer.ai/ui/*`.
- Web origins: `https://orca-infer.ai` (no path and no wildcard).

For local development, add `http://localhost:8080/ui/*` to valid redirect URIs
and `http://localhost:8080` to web origins. Visit `http://localhost:8080/ui/`.

## Deployment Configuration

Set these public environment variables before running `npm run build`:

```dotenv
VITE_KEYCLOAK_ENABLED=true
VITE_KEYCLOAK_URL=https://orca-infer.ai/auth
VITE_KEYCLOAK_REALM=your-realm
VITE_KEYCLOAK_CLIENT_ID=orca-ui
```

Vite embeds these values at build time; changing only the deployed container's
runtime environment will not update the browser bundle. Never put secrets in
`VITE_*` variables. Authentication is enabled by default and fails closed if
configuration is missing. `VITE_KEYCLOAK_ENABLED=false` explicitly bypasses the
UI gate for local development only.

The Keycloak URL must be its actual externally reachable base URL. Use `/auth`
only if your ingress/Keycloak deployment serves it there; modern Keycloak does
not use `/auth` by default. Its realm discovery endpoint must be reachable at
`https://orca-infer.ai/auth/realms/your-realm/.well-known/openid-configuration`,
and advertise public HTTPS authorization and token endpoints.

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
goes to `/auth/realms/<realm>/protocol/openid-connect/auth`, complete sign-in,
and verify you return to `/ui/` (or the product route you opened). Test a reload
and a session expiry as well. A successful build cannot verify the deployed
realm, ingress, redirect URI allowlist or login credentials.
