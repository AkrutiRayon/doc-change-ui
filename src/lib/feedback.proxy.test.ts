import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { proxyFeedback } from "./feedback.proxy";

const feedbackConfig = vi.hoisted(() => ({
  FEEDBACK_BASE_URL: "http://feedback",
  KEYCLOAK_ISSUER: "https://keycloak.example/realms/orca",
  KEYCLOAK_AUDIENCE: "orca-feedback",
  KEYCLOAK_JWKS_URL: undefined as string | undefined,
  feedbackConfigurationError: () => undefined,
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return { ...actual, createRemoteJWKSet: vi.fn(() => vi.fn()), jwtVerify: vi.fn() };
});

vi.mock("@/lib/feedback.config", () => feedbackConfig);

function feedbackRequest() {
  return new Request("http://localhost/api/v1/rag-go/feedback", {
    method: "POST",
    headers: { Authorization: "Bearer private-access-token" },
    body: "{}",
  });
}

afterEach(() => {
  feedbackConfig.KEYCLOAK_JWKS_URL = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("feedback authentication diagnostics", () => {
  it.each([
    undefined,
    "http://kc-keycloakx-http.hawk.svc.cluster.local/auth/realms/orca/protocol/openid-connect/certs",
  ])(
    "uses the configured signing-key endpoint %s without changing issuer validation",
    async (url) => {
      feedbackConfig.KEYCLOAK_JWKS_URL = url;
      vi.mocked(jwtVerify).mockResolvedValueOnce({
        payload: { sub: "verified-user" },
        protectedHeader: { alg: "RS256" },
      });
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "received" }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await proxyFeedback(feedbackRequest());

      expect(response.status).toBe(200);
      expect(createRemoteJWKSet).toHaveBeenLastCalledWith(
        new URL(url ?? "https://keycloak.example/realms/orca/protocol/openid-connect/certs"),
      );
      expect(jwtVerify).toHaveBeenLastCalledWith("private-access-token", expect.any(Function), {
        issuer: "https://keycloak.example/realms/orca",
        audience: "orca-feedback",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://feedback/api/v1/rag-go/feedback",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-ID": "verified-user",
          },
        }),
      );
    },
  );

  it("reports an audience failure without logging the token or claim values", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(jwtVerify).mockRejectedValueOnce(
      new errors.JWTClaimValidationFailed("unexpected aud", { aud: "private-value" }, "aud"),
    );

    const response = await proxyFeedback(feedbackRequest());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith("[Feedback authentication failed]", {
      code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
      claim: "aud",
      issuer: "https://keycloak.example/realms/orca",
      audience: "orca-feedback",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-");
  });

  it("distinguishes signing-key request failures from invalid claims", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(jwtVerify).mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await proxyFeedback(feedbackRequest());

    expect(response.status).toBe(401);
    expect(warning).toHaveBeenCalledWith(
      "[Feedback authentication failed]",
      expect.objectContaining({ code: "KEYCLOAK_JWKS_REQUEST_FAILED", claim: undefined }),
    );
  });

  it("reports a missing subject without forwarding feedback", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: {}, protectedHeader: { alg: "RS256" } });

    const response = await proxyFeedback(feedbackRequest());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith("[Feedback authentication failed]", {
      code: "MISSING_SUBJECT",
    });
  });
});
