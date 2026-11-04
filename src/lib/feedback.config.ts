const configuredFeedbackBaseUrl = process.env["FEEDBACK_BASE_URL"]?.trim();

export const FEEDBACK_BASE_URL = configuredFeedbackBaseUrl?.replace(/\/+$/, "");
export const KEYCLOAK_ISSUER = process.env["KEYCLOAK_ISSUER"]?.trim();
export const KEYCLOAK_AUDIENCE = process.env["KEYCLOAK_AUDIENCE"]?.trim();
export const KEYCLOAK_JWKS_URL = process.env["KEYCLOAK_JWKS_URL"]?.trim() || undefined;

export function feedbackConfigurationError(): string | undefined {
  if (!FEEDBACK_BASE_URL) return "Feedback service is not configured.";
  if (!KEYCLOAK_ISSUER || !KEYCLOAK_AUDIENCE) {
    return "Feedback authentication is not configured.";
  }
  return undefined;
}
