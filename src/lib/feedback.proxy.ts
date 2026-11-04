import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  FEEDBACK_BASE_URL,
  KEYCLOAK_AUDIENCE,
  KEYCLOAK_ISSUER,
  feedbackConfigurationError,
} from "@/lib/feedback.config";

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function proxyFeedback(request: Request): Promise<Response> {
  const configurationError = feedbackConfigurationError();
  if (configurationError) return jsonError(503, configurationError);

  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return jsonError(401, "Authentication is required to submit feedback.");

  const userId = await verifiedSubject(token);
  if (!userId)
    return jsonError(401, "Your sign-in session could not be verified. Please sign in again.");

  let body: string;
  try {
    body = await request.text();
    JSON.parse(body);
  } catch {
    return jsonError(400, "Feedback must be valid JSON.");
  }

  try {
    const upstream = await fetch(`${FEEDBACK_BASE_URL}/api/v1/rag-go/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-ID": userId,
      },
      body,
      signal: request.signal,
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return jsonError(
      502,
      "The feedback service could not be reached. Submission status is uncertain.",
    );
  }
}

async function verifiedSubject(token: string): Promise<string | undefined> {
  try {
    const issuer = KEYCLOAK_ISSUER!;
    const jwks =
      jwksByIssuer.get(issuer) ??
      createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
    jwksByIssuer.set(issuer, jwks);
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: KEYCLOAK_AUDIENCE!,
    });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

function bearerToken(header: string | null): string | undefined {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
