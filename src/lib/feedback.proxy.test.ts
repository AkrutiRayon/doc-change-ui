import { afterEach, describe, expect, it, vi } from "vitest";
import { errors, jwtVerify } from "jose";
import { proxyFeedback } from "./feedback.proxy";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return { ...actual, createRemoteJWKSet: vi.fn(), jwtVerify: vi.fn() };
});

vi.mock("@/lib/feedback.config", () => ({
  FEEDBACK_BASE_URL: "http://feedback",
  KEYCLOAK_ISSUER: "https://keycloak.example/realms/orca",
  KEYCLOAK_AUDIENCE: "orca-feedback",
  feedbackConfigurationError: () => undefined,
}));

function feedbackRequest() {
  return new Request("http://localhost/api/v1/rag-go/feedback", {
    method: "POST",
    headers: { Authorization: "Bearer private-access-token" },
    body: "{}",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("feedback authentication diagnostics", () => {
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
