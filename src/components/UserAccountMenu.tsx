import { useKeycloak } from "@react-keycloak/web";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isKeycloakEnabled } from "@/lib/keycloak";

export function UserAccountMenu() {
  if (!isKeycloakEnabled()) return null;
  return <AuthenticatedUserAccountMenu />;
}

function AuthenticatedUserAccountMenu() {
  const { keycloak } = useKeycloak();
  const tokenUsername =
    keycloak.tokenParsed?.preferred_username ?? keycloak.idTokenParsed?.preferred_username;
  const [username, setUsername] = useState(
    typeof tokenUsername === "string" ? tokenUsername : "User",
  );
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void keycloak
      .loadUserProfile()
      .then((profile) => {
        if (!cancelled && profile.username) setUsername(profile.username);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [keycloak]);

  const logout = () => {
    setLoggingOut(true);
    void keycloak
      .logout({
        redirectUri: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      })
      .catch(() => setLoggingOut(false));
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="max-w-32 truncate rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground sm:max-w-48"
        title={username}
      >
        {username}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={logout}
        disabled={loggingOut}
        aria-label="Log out"
        title="Log out"
      >
        <LogOut />
      </Button>
    </div>
  );
}