import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const configuredRagBaseUrl =
  process.env["RAG_BASE_URL"]?.trim() || process.env["RAG_BASE_HOST"]?.trim();
const RAG_BASE_URL = normalizeRagBaseUrl(configuredRagBaseUrl || "http://infer.hawk-llm.ai");
const RAG_PATH = "/api/v1/rag-go";

function normalizeRagBaseUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

const InputSchema = z.object({
  queryText: z.string().min(1),
  repoId: z.string().min(1),
  type: z.enum(["standard", "direct"]),
  limit: z.number().int().positive().default(15),
  endpoint: z.enum(["search", "generate-doc"]).default("search"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  bustCache: z.number().optional(),
});

type RagResponse = {
  answer?: unknown;
  type?: "standard" | "direct";
  sources?: {
    change_chunks_retrieved?: number;
    code_chunks_retrieved?: number;
  };
  meta?: {
    repo_id?: string;
    query_text?: string;
  };
};

export const runRagSearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const endpointUrl =
      data.endpoint === "generate-doc"
        ? `${RAG_BASE_URL}${RAG_PATH}/generate-doc`
        : `${RAG_BASE_URL}${RAG_PATH}`;

    const payload = {
      query_text: data.queryText,
      repo_id: data.repoId,
      limit: data.limit,
      type: data.type,
      ...(data.type === "standard" && data.fromDate && data.toDate
        ? { from_date: data.fromDate, to_date: data.toDate }
        : {}),
    };
    const body = JSON.stringify(payload);

    const ENABLE_RAG_CACHE = (process.env['ENABLE_RAG_CACHE'] || "false").toLowerCase() === "true";
    const cacheStatus = ENABLE_RAG_CACHE ? "enabled" : "disabled";

    // generate a request UUID and timestamp for diagnostics
    const requestUuid =
      typeof (globalThis as any).crypto === "object" && typeof (globalThis as any).crypto.randomUUID === "function"
        ? (globalThis as any).crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const backendRequestTimestamp = new Date().toISOString();

    const startedAt = Date.now();

    console.info("[RAG request]", {
      endpoint: data.endpoint,
      url: endpointUrl,
      payload,
      requestUuid,
      cacheStatus,
    });

    // enforce fresh fetches for RAG calls unless explicitly enabled via env
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!ENABLE_RAG_CACHE) {
      requestHeaders["Cache-Control"] = "no-store";
      requestHeaders["Pragma"] = "no-cache";
      console.info("[CACHE] disabled");
    } else {
      console.info("[CACHE] enabled via ENABLE_RAG_CACHE=true");
    }
    requestHeaders["X-Request-Id"] = requestUuid;

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: requestHeaders,
      body,
    });

    console.info("[RAG response]", {
      endpoint: data.endpoint,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RAG API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as any;

    // determine cache hit/miss if backend exposes it
    const backendCacheIndicator = pickFirstPresent(json, ["cache_status", "cacheStatus", "cache"]);
    const cacheIndicator = backendCacheIndicator ?? (ENABLE_RAG_CACHE ? "unknown" : "bypassed");
    if (!ENABLE_RAG_CACHE) console.info("[CACHE] bypassed");
    if (typeof cacheIndicator === "string") {
      if (cacheIndicator.toLowerCase() === "hit" || cacheIndicator.toLowerCase() === "cache_hit") {
        console.info("[CACHE] cache hit");
      } else if (cacheIndicator.toLowerCase() === "miss" || cacheIndicator.toLowerCase() === "cache_miss") {
        console.info("[CACHE] cache miss");
      }
    }

    console.info("[RAG raw API response]", json);
    console.info("[RAG diagnostics]", {
      requestUuid,
      backendRequestTimestamp,
      cacheStatus: cacheIndicator,
      finalPayload: payload,
      retrievedContext: pickFirstPresent(json, [
        "retrieved_context",
        "retrievedContext",
        "context",
        "chunks",
        "retrieved_chunks",
        "retrievedChunks",
      ]),
      chunkIds: pickFirstPresent(json, ["chunk_ids", "chunkIds"]),
      commitIds: pickFirstPresent(json, ["commit_ids", "commitIds"]),
      fileIds: pickFirstPresent(json, ["file_ids", "fileIds"]),
      retrievalScores: pickFirstPresent(json, [
        "retrieval_scores",
        "retrievalScores",
        "scores",
      ]),
      finalPrompt: pickFirstPresent(json, ["final_prompt", "finalPrompt", "prompt"]),
      modelSettings: pickFirstPresent(json, [
        "model_settings",
        "modelSettings",
        "llm_config",
        "llmConfig",
        "generation_config",
        "generationConfig",
      ]),
      rawLlmResponse: json['answer'] ?? json,
      diagnosticsAvailability:
        "If any field above is undefined, /api/v1/rag-go did not return it to this UI.",
    });

    // attach diagnostics for UI consumption
    try {
      if (!json['debug'] || typeof json['debug'] !== "object") json['debug'] = {};
      (json['debug'] as Record<string, unknown>)['_ui'] = {
        requestUuid,
        backendRequestTimestamp,
        cacheStatus: cacheIndicator,
      };
    } catch (e) {
      // ignore
    }

    return json as any;
  });

function pickFirstPresent(record: any, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }

  const debug = record['debug'];
  if (debug && typeof debug === "object" && !Array.isArray(debug)) {
    return pickFirstPresent(debug as Record<string, unknown>, keys);
  }

  const meta = record['meta'];
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return pickFirstPresent(meta as Record<string, unknown>, keys);
  }

  return undefined;
}
