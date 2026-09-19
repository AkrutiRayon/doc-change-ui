import { RAG_BASE_URL, RAG_PATH } from "@/lib/rag.config";

// Streams the upstream RAG SSE response straight through to the browser (createServerFn can't stream).
export async function proxyRagStream(request: Request, pathSuffix: string): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = `${RAG_BASE_URL}${RAG_PATH}${pathSuffix}${incomingUrl.search}`;
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: request.headers.get("accept") ?? "application/json",
      },
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch failure";
    return new Response(JSON.stringify({ error: `RAG API fetch failed: ${message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      ...(contentType.includes("text/event-stream")
        ? { "Cache-Control": "no-cache", Connection: "keep-alive" }
        : {}),
    },
  });
}
