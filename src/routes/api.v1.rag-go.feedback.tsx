import { createFileRoute } from "@tanstack/react-router";
import { proxyFeedback } from "@/lib/feedback.proxy";

export const Route = createFileRoute("/api/v1/rag-go/feedback")({
  server: { handlers: { POST: ({ request }) => proxyFeedback(request) } },
});
