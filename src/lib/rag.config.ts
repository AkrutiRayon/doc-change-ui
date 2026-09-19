const configuredRagBaseUrl =
  process.env["RAG_BASE_URL"]?.trim() || process.env["RAG_BASE_HOST"]?.trim();

export const RAG_BASE_URL = normalizeRagBaseUrl(configuredRagBaseUrl || "http://orca-infer.ai");
export const RAG_PATH = "/api/v1/rag-go";

function normalizeRagBaseUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/+$/, "");
}
