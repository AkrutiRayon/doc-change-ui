import { ReactKeycloakProvider, useKeycloak } from "@react-keycloak/web";
import { useEffect, useState, type ReactNode } from "react";
import type Keycloak from "keycloak-js";
import type { KeycloakInitOptions } from "keycloak-js";
import { getKeycloakClient, getKeycloakInitOptions, isKeycloakEnabled } from "@/lib/keycloak";

function AuthStatus({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground"
    >
      <p>{message}</p>
    </div>
  );
}

function AuthenticatedContent({ children }: { children: ReactNode }) {
  const { keycloak, initialized } = useKeycloak();
  if (!initialized || !keycloak.authenticated) {
    return <AuthStatus message="Signing in..." />;
  }
  return children;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<{
    client: Keycloak;
    options: KeycloakInitOptions;
  } | null>(null);

  useEffect(() => {
    setReady(true);
    if (!isKeycloakEnabled()) return;
    try {
      setAuth({ client: getKeycloakClient(), options: getKeycloakInitOptions() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication configuration failed.");
    }
  }, []);

  if (error) return <AuthStatus message={error} />;
  if (!ready) return <AuthStatus message="Signing in..." />;
  if (!isKeycloakEnabled()) return children;
  if (!auth) return <AuthStatus message="Signing in..." />;

  return (
    <ReactKeycloakProvider
      authClient={auth.client}
      initOptions={auth.options}
      LoadingComponent={<AuthStatus message="Signing in..." />}
      onEvent={(event) => {
        if (event === "onInitError" || event === "onAuthError" || event === "onAuthRefreshError") {
          setError("Sign-in failed. Please reload the page to try again.");
        } else if (event === "onAuthLogout") {
          setError("Your session has ended. Please reload the page to sign in again.");
        }
      }}
    >
      <AuthenticatedContent>{children}</AuthenticatedContent>
    </ReactKeycloakProvider>
  );
}
