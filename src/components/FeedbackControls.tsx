import { useEffect, useId, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getKeycloakClient } from "@/lib/keycloak";
import type { FeedbackRating, FeedbackSubmission, FeedbackTransaction } from "@/lib/feedback.types";

type SubmissionState = "idle" | "editing" | "submitting" | "submitted" | "conflict" | "error";

export function FeedbackControls({ transaction }: { transaction: FeedbackTransaction }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SubmissionState>("idle");
  const [message, setMessage] = useState("");
  const commentId = useId();

  useEffect(() => {
    setRating(null);
    setComment("");
    setState("idle");
    setMessage("");
  }, [transaction.request_id]);

  const chooseRating = (nextRating: FeedbackRating) => {
    if (state === "submitting" || state === "submitted" || state === "conflict") return;
    setRating(nextRating);
    setState("editing");
    setMessage("");
  };

  const submit = async () => {
    if (!rating || state === "submitting") return;
    setState("submitting");
    setMessage("");
    try {
      const keycloak = getKeycloakClient();
      await keycloak.updateToken(30);
      if (!keycloak.token)
        throw new Error("Your sign-in session is unavailable. Please sign in again.");
      const trimmedComment = comment.trim();
      const payload: FeedbackSubmission = {
        ...transaction,
        feedback: { rating, ...(trimmedComment ? { comment: trimmedComment } : {}) },
      };
      const response = await fetch(`${import.meta.env.BASE_URL}api/v1/rag-go/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        status?: unknown;
      };
      if (response.status === 200 && result.status === "received") {
        setState("submitted");
        setMessage("Thank you for your feedback.");
      } else if (response.status === 409) {
        setState("conflict");
        setMessage("Feedback for this response has already been recorded and cannot be changed.");
      } else if (response.status === 401) {
        setState("error");
        setMessage(
          "Your sign-in session could not be verified. Please sign in again and try once.",
        );
      } else if (response.status === 403) {
        setState("error");
        setMessage("You do not have permission to submit feedback for this response.");
      } else {
        setState("error");
        setMessage(
          typeof result.error === "string"
            ? result.error
            : "Feedback could not be submitted. Please try again.",
        );
      }
    } catch {
      setState("error");
      setMessage("Feedback could not be submitted. Its status is uncertain; retry only if appropriate.");
    }
  };

  if (state === "submitted" || state === "conflict") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {message}
      </p>
    );
  }

  return (
    <section className="mt-5 border-t border-border pt-4" aria-label="Response feedback">
      <p className="text-sm font-medium">Was this response helpful?</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={rating === "up" ? "default" : "outline"}
          size="sm"
          aria-pressed={rating === "up"}
          onClick={() => chooseRating("up")}
          disabled={state === "submitting"}
        >
          <ThumbsUp className="h-4 w-4" /> Helpful
        </Button>
        <Button
          type="button"
          variant={rating === "down" ? "default" : "outline"}
          size="sm"
          aria-pressed={rating === "down"}
          onClick={() => chooseRating("down")}
          disabled={state === "submitting"}
        >
          <ThumbsDown className="h-4 w-4" /> Not helpful
        </Button>
      </div>
      {state === "editing" || state === "submitting" || state === "error" ? (
        <div className="mt-3 max-w-xl space-y-3">
          <p className="text-xs text-muted-foreground">
            Your question, generated response, and feedback will be submitted and associated with
            your signed-in account.
          </p>
          <label htmlFor={commentId} className="text-sm font-medium">
            Comment <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id={commentId}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={state === "submitting"}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {message && (
            <p role="status" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submit} disabled={state === "submitting"}>
              {state === "submitting" ? "Submitting…" : "Submit feedback"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={state === "submitting"}
              onClick={() => {
                setState("idle");
                setRating(null);
                setComment("");
                setMessage("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
