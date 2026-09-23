import { useEffect, useRef, useState } from "react";

// Infinite loading ring for streaming responses.
// `inline` keeps it in the flow alongside the status text.
export function TopProgressBar({
  active,
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
      hideTimeoutRef.current = setTimeout(() => setVisible(false), 300);
    }

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [active]);

  if (!visible) return null;

  return (
    <span
      className={
        inline
          ? "inline-flex h-4 w-4 shrink-0 items-center justify-center"
          : "pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center justify-center py-2"
      }
      aria-label="Loading"
      role="status"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
    </span>
  );
}
