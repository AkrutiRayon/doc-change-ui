import { RAG_BASE_URL, RAG_PATH } from "@/lib/rag.config";

const KEEP_ALIVE_INTERVAL_MS = 15_000;
const UPSTREAM_IDLE_TIMEOUT_MS = 5 * 60_000;

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
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      body,
      signal: request.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch failure";
    return new Response(JSON.stringify({ error: `RAG API fetch failed: ${message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const isEventStream = contentType.toLowerCase().includes("text/event-stream");
  const responseBody =
    isEventStream && upstream.body ? keepEventStreamAlive(upstream.body) : upstream.body;
  return new Response(responseBody, {
    status: upstream.status,
    headers: new Headers({
      "Content-Type": contentType,
      ...(isEventStream
        ? {
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          }
        : {}),
    }),
  });
}

function keepEventStreamAlive(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const heartbeat = new TextEncoder().encode(": keep-alive\n");
  const idleTimeoutEvent = encoder.encode(
    'event: error\ndata: {"error":"RAG backend stopped sending data for 5 minutes."}\n\n',
  );
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let pendingText = "";
  let isActive = true;
  let lastUpstreamActivityAt = Date.now();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      heartbeatTimer = setInterval(() => {
        if (!isActive) return;
        if (Date.now() - lastUpstreamActivityAt >= UPSTREAM_IDLE_TIMEOUT_MS) {
          isActive = false;
          controller.enqueue(idleTimeoutEvent);
          controller.close();
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          void reader
            .cancel()
            .catch((error) => console.error("Failed to cancel idle RAG stream", error));
          return;
        }
        controller.enqueue(heartbeat);
      }, KEEP_ALIVE_INTERVAL_MS);

      void (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done || !isActive) break;

            lastUpstreamActivityAt = Date.now();
            const text = decoder.decode(value, { stream: true });
            if (text) {
              pendingText += text;
              const safeText =
                pendingText.endsWith("\r") ? pendingText.slice(0, -1) : pendingText;
              const lastLineEnd = Math.max(
                safeText.lastIndexOf("\n"),
                safeText.lastIndexOf("\r"),
              );
              if (lastLineEnd !== -1) {
                controller.enqueue(encoder.encode(pendingText.slice(0, lastLineEnd + 1)));
                pendingText = pendingText.slice(lastLineEnd + 1);
              }
            }
          }

          pendingText += decoder.decode();
          if (pendingText && isActive) controller.enqueue(encoder.encode(pendingText));
          if (isActive) controller.close();
        } catch (error) {
          if (isActive) controller.error(error);
        } finally {
          isActive = false;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          reader.releaseLock();
        }
      })();
    },
    async cancel(reason) {
      isActive = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      await reader.cancel(reason);
    },
  });
}
