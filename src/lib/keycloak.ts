import Keycloak, { type KeycloakConfig, type KeycloakInitOptions } from "keycloak-js";

type ViteEnvLike = {
  VITE_KEYCLOAK_URL?: string;
  VITE_KEYCLOAK_REALM?: string;
  VITE_KEYCLOAK_CLIENT_ID?: string;
  VITE_KEYCLOAK_ENABLED?: string;
};

let keycloakClient: Keycloak | null = null;

function env(): ViteEnvLike {
  return import.meta.env as unknown as ViteEnvLike;
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function isKeycloakEnabled(): boolean {
  const raw = env().VITE_KEYCLOAK_ENABLED;
  if (raw == null) return true;
  return raw.toLowerCase() === "true";
}

export function getKeycloakConfig(): KeycloakConfig {
  const viteEnv = env();
  const url = viteEnv.VITE_KEYCLOAK_URL;
  const realm = viteEnv.VITE_KEYCLOAK_REALM;
  const clientId = viteEnv.VITE_KEYCLOAK_CLIENT_ID;

  if (!url || !realm || !clientId) {
    throw new Error(
      "Missing Keycloak configuration. Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID.",
    );
  }

  return {
    url: normalizeBaseUrl(url),
    realm,
    clientId,
  };
}

export function getKeycloakClient(): Keycloak {
  if (!keycloakClient) {
    keycloakClient = new Keycloak(getKeycloakConfig());
  }
  return keycloakClient;
}

export function getKeycloakInitOptions(): KeycloakInitOptions {
  return {
    onLoad: "login-required",
    pkceMethod: "S256",
    checkLoginIframe: false,
    ...(typeof window !== "undefined" ? { redirectUri: window.location.href } : {}),
  };
}
