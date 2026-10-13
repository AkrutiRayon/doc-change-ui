import Keycloak, { type KeycloakConfig, type KeycloakInitOptions } from "keycloak-js";

export type KeycloakRuntimeConfig = {
  enabled: boolean;
  url: string;
  realm: string;
  clientId: string;
};

let keycloakClient: Keycloak | null = null;
let runtimeConfig: KeycloakRuntimeConfig | null = null;

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function setKeycloakRuntimeConfig(config: KeycloakRuntimeConfig): void {
  runtimeConfig = config;
}

export function isKeycloakEnabled(): boolean {
  return runtimeConfig?.enabled ?? true;
}

export function getKeycloakConfig(): KeycloakConfig {
  if (!runtimeConfig) throw new Error("Keycloak runtime configuration has not been loaded.");

  return {
    url: normalizeBaseUrl(runtimeConfig.url),
    realm: runtimeConfig.realm,
    clientId: runtimeConfig.clientId,
  };
}

export function getKeycloakClient(): Keycloak {
  if (!keycloakClient) {
    keycloakClient = new Keycloak(getKeycloakConfig());
  }
  return keycloakClient;
}

export function getKeycloakSubject(): string {
  return keycloakClient?.subject ?? "anonymous";
}

export function getKeycloakInitOptions(): KeycloakInitOptions {
  return {
    onLoad: "login-required",
    pkceMethod: "S256",
    checkLoginIframe: true,
    ...(typeof window !== "undefined" ? { redirectUri: window.location.href } : {}),
  };
}
