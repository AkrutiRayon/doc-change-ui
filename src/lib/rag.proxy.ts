import { RAG_BASE_URL, RAG_PATH } from "@/lib/rag.config";

// Streams the upstream RAG SSE response straight through to the browser (createServerFn can't stream).
export async function proxyRagStream(request: Request, pathSuffix: string): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = `${RAG_BASE_URL}${RAG_PATH}${pathSuffix}${incomingUrl.search}`;
  const body = await request.text();
  const startupController = new AbortController();
  const startupTimeout = setTimeout(
    () =>
      startupController.abort(new DOMException("RAG stream did not start in time", "TimeoutError")),
    60_000,
  );

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: request.headers.get("accept") ?? "application/json",
      },
      body,
      signal: AbortSignal.any([request.signal, startupController.signal]),
    });
  } catch (error) {
    if (startupController.signal.aborted) {
      return new Response(
        JSON.stringify({ error: "RAG stream did not start within 60 seconds." }),
        {
          status: 504,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown fetch failure";
    return new Response(JSON.stringify({ error: `RAG API fetch failed: ${message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(startupTimeout);
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
