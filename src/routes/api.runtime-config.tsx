import { createFileRoute } from "@tanstack/react-router";

type RuntimeEnv = Record<string, string | undefined>;

export const Route = createFileRoute("/api/runtime-config")({
  server: {
    handlers: {
      GET: () => {
        const viteEnv = import.meta.env as unknown as RuntimeEnv;
        const runtimeEnv = process.env;
        const value = (name: string, fallback: string) =>
          runtimeEnv[name]?.trim() || viteEnv[name]?.trim() || fallback;

        return Response.json(
          {
            enabled: value("VITE_KEYCLOAK_ENABLED", "true").toLowerCase() !== "false",
            url: value("VITE_KEYCLOAK_URL", "https://orca-infer.ai"),
            realm: value("VITE_KEYCLOAK_REALM", "orca"),
            clientId: value("VITE_KEYCLOAK_CLIENT_ID", "orca-client"),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});