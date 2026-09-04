"use client";

import { useEffect, useRef } from "react";

interface LoadMoreSentinelProps {
  onIntersect: () => void;
  disabled?: boolean;
  /**
   * Anything that changes once a page finishes loading (module count works
   * well). Re-observing on change re-checks the sentinel's *current*
   * position: appending a page can leave it still on-screen (short pages,
   * a tall viewport), and since IntersectionObserver's callback only fires
   * on threshold crossings, a sentinel that never left the viewport
   * wouldn't otherwise fire again -- this is what drives the "keep loading
   * until the initial viewport is actually full" cascade, independent of
   * any real user scroll.
   */
  refreshKey?: unknown;
}

/** Invisible marker element; fires onIntersect once it scrolls near the viewport. */
export default function LoadMoreSentinel({ onIntersect, disabled, refreshKey }: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onIntersect, disabled, refreshKey]);

  return <div ref={ref} aria-hidden style={{ height: 1 }} />;
}
