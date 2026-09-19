import { createFileRoute } from "@tanstack/react-router";
import { proxyRagStream } from "@/lib/rag.proxy";

export const Route = createFileRoute("/api/v1/rag-go")({
  server: {
    handlers: {
      POST: ({ request }) => proxyRagStream(request, ""),
    },
  },
});
