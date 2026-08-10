import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RAG_BASE_URL =
  "http://vs345305svc232297.mock-eu.blazemeter.com/api/v1/rag-go";

const InputSchema = z.object({
  queryText: z.string().min(1),
  repoId: z.string().min(1),
  type: z.enum(["standard", "direct"]),
  limit: z.number().int().positive().default(15),
  endpoint: z.enum(["search", "generate-doc"]).default("search"),
});

type RagResponse = {
  answer: string;
  type: "standard" | "direct";
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
      data.endpoint === "generate-doc" ? `${RAG_BASE_URL}/generate-doc` : RAG_BASE_URL;

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_text: data.queryText,
        repo_id: data.repoId,
        type: data.type,
        limit: data.limit,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mock API error ${response.status}: ${text}`);
    }

    return (await response.json()) as RagResponse;
  });
