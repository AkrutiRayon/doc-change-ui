import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  productName: string;
};

const FREQUENCIES = ["Instant", "Daily", "Weekly", "Monthly"];

export function SubscribeModal({ open, onClose, productName }: Props) {
  const [channel, setChannel] = useState<"email" | "slack">("email");
  const [frequency, setFrequency] = useState("Daily");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Subscribe to updates"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          ×
        </button>

        <h3 className="text-xl font-bold tracking-tight">Subscribe to Updates</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Get notified about {productName} documentation changes
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Notification channel</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["email", "slack"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`rounded-lg border px-4 py-3 text-sm capitalize transition-colors ${
                  channel === c
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        {channel === "email" && (
          <div className="mt-5">
            <label htmlFor="sub-email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="sub-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            />
          </div>
        )}

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Frequency</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                  frequency === f
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => {
            setDone(true);
            setTimeout(() => {
              setDone(false);
              onClose();
            }, 1200);
          }}
          className="mt-7 w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {done ? "Subscribed!" : "Subscribe"}
        </button>
      </div>
    </div>
  );
}
