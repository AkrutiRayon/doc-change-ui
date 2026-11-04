export type FeedbackWorkflow = "standard" | "direct" | "generate-doc";
export type FeedbackRating = "up" | "down";

export type OrcaRequest = {
  query_text: string;
  repo_id?: string;
  repo_name?: string;
  type?: string;
  limit?: number;
  token_limit?: number;
  component?: string;
  from_date?: string;
  to_date?: string;
};

export type OrcaResponse = {
  answer: string;
  type: string;
  sources: Record<string, number>;
  meta: {
    repo_id: string;
    component?: string;
    query_text: string;
    context_truncation_enabled: boolean;
    context_truncation_active: boolean;
  };
};

export type FeedbackSubmission = {
  workflow: FeedbackWorkflow;
  request_id: string;
  request: OrcaRequest;
  response: OrcaResponse;
  feedback: { rating: FeedbackRating; comment?: string };
};

export type FeedbackTransaction = Omit<FeedbackSubmission, "feedback">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isOrcaResponse(value: unknown): value is OrcaResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  if (typeof response.answer !== "string" || typeof response.type !== "string") return false;
  if (!isNumberRecord(response.sources) || !isMeta(response.meta)) return false;
  return true;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "number")
  );
}

function isMeta(value: unknown): value is OrcaResponse["meta"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.repo_id === "string" &&
    typeof meta.query_text === "string" &&
    typeof meta.context_truncation_enabled === "boolean" &&
    typeof meta.context_truncation_active === "boolean" &&
    (meta.component === undefined || typeof meta.component === "string")
  );
}
