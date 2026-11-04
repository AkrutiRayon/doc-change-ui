import { describe, expect, it } from "vitest";
import { isCanonicalRequestId, isOrcaResponse } from "./feedback.types";

const response = {
  answer: '{"changes_markdown":"# Changes"}',
  type: "",
  sources: { code_chunks_retrieved: 3, change_chunks_retrieved: 0 },
  meta: {
    repo_id: "github.com/example/repo",
    query_text: "How do I deploy?",
    context_truncation_enabled: true,
    context_truncation_active: false,
  },
};

describe("feedback transaction guards", () => {
  it("keeps document answers as their original JSON-encoded string", () => {
    expect(isOrcaResponse(response)).toBe(true);
    expect(response.answer).toBe('{"changes_markdown":"# Changes"}');
  });

  it("requires a canonical lowercase UUID request id", () => {
    expect(isCanonicalRequestId("8b8047e6-8363-4382-93e3-1ad99f75adf3")).toBe(true);
    expect(isCanonicalRequestId("8B8047E6-8363-4382-93E3-1AD99F75ADF3")).toBe(false);
    expect(isCanonicalRequestId("missing")).toBe(false);
  });

  it("does not enable feedback when response metadata is incomplete", () => {
    expect(isOrcaResponse({ ...response, meta: { repo_id: "repo" } })).toBe(false);
  });
});
