import { useEffect, useRef, useState } from "react";

// Loading bar driven by real progress percentages (e.g. from RAG SSE events).
// `inline` renders in normal document flow instead of fixed to the viewport top.
export function TopProgressBar({
  active,
  progress = 0,
  inline = false,
}: {
  active: boolean;
  progress?: number;
  inline?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setVisible(true);
    } else {
      hideTimeoutRef.current = setTimeout(() => setVisible(false), 400);
    }

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [active]);

  if (!visible) return null;

  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={
        inline
          ? "h-1 w-full overflow-hidden rounded-full bg-muted"
          : "pointer-events-none fixed inset-x-0 top-0 z-[100] h-1"
      }
    >
      <div
        className="relative h-full overflow-hidden bg-black transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      >
        <div className="animate-shine absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </div>
    </div>

  );
}
