import { useEffect, useRef, useState } from "react";

const WAVE_PERIOD = 20;
const WAVE_TILE_WIDTH = 400;
// One wavy tile: alternating quadratic bumps above/below the baseline, repeated via `T`.
const WAVE_PATH = (() => {
  let d = "M0,4 Q5,0 10,4";
  for (let x = WAVE_PERIOD; x <= WAVE_TILE_WIDTH; x += WAVE_PERIOD / 2) {
    d += ` T${x},4`;
  }
  return d;
})();

// Loading indicator driven by real progress percentages (e.g. from RAG SSE events).
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
          ? "h-2 w-full overflow-hidden"
          : "pointer-events-none fixed inset-x-0 top-0 z-[100] h-2"
      }
    >
      <div
        className="relative h-full overflow-hidden transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      >
        <svg
          className="animate-wave-scroll h-full w-full"
          width="100%"
          height={8}
          viewBox={`0 0 ${WAVE_TILE_WIDTH} 8`}
          preserveAspectRatio="none"
        >
          <path
            d={WAVE_PATH}
            fill="none"
            stroke="black"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>

  );
}
