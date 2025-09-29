import { useEffect, useRef, useState } from "react";

/**
 * HourCarousel
 * - Displays 24 hour cards (0..23) with labels 12AM..11PM
 * - Uses triple-buffer trick (items duplicated 3x) so we can "reset" scroll
 *   to the middle set to create a smooth infinite-scroll illusion.
 *
 * Accessibility:
 * - The container is focusable and supports left/right arrow keys to move.
 * - Each card is rendered as a button for easy focus & activation in the future.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number) {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return { display: `${hour12}`, ampm };
}

export default function HourCarousel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLButtonElement | null>(null); // to measure width
  const rafRef = useRef<number | null>(null);

  // used for re-render when widths are measured
  const [, setMeasured] = useState(0);

  // scroll-reset thresholds (computed after mount)
  const singleWidthRef = useRef<number>(0);
  const totalSingleContentWidthRef = useRef<number>(0); // width of 24 items
  const isUserInteractingRef = useRef(false);

  // helper: duplicate HOURS 3 times
  const tripled = [...HOURS, ...HOURS, ...HOURS];

  // Measure widths and set initial scroll to middle chunk
  useEffect(() => {
    const container = containerRef.current;
    const item = itemRef.current;
    if (!container || !item) return;

    const measure = () => {
      const itemWidth = item.getBoundingClientRect().width;
      singleWidthRef.current = itemWidth;
      totalSingleContentWidthRef.current = itemWidth * HOURS.length;

      // Initially jump to middle copy for infinite illusion
      // scrollLeft should be width of one copy (the first 24 items).
      // We use setTimeout 0 to allow the browser to apply layout first.
      container.scrollLeft = totalSingleContentWidthRef.current;
      setMeasured((n) => n + 1);
    };

    // measure now and again after a short delay (handles fonts or layout)
    measure();
    const t = setTimeout(measure, 50);

    // ensure we clean up
    return () => clearTimeout(t);
  }, []);

  // Smoothly maintain "infinite" illusion: when user scrolls near ends, jump back to mid
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;

    const handle = () => {
      if (!container) return;
      const single = totalSingleContentWidthRef.current;
      if (single === 0) return;

      const left = container.scrollLeft;

      // thresholds: if we go too far left (< 0.5 * single) or too far right (> 1.5 * single)
      // we move scroll by +/- single to re-center on the middle copy.
      if (left < single * 0.5) {
        // jumped too far left -> move right by one single copy
        container.scrollLeft = left + single;
      } else if (left > single * 1.5) {
        // jumped too far right -> move left by one single copy
        container.scrollLeft = left - single;
      }

      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      // use rAF to avoid jank
      rafRef.current = requestAnimationFrame(handle);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // keyboard support (left/right to move by one item)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Right") {
        e.preventDefault();
        scrollByItems(1);
      } else if (e.key === "ArrowLeft" || e.key === "Left") {
        e.preventDefault();
        scrollByItems(-1);
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, []);

  // scroll by n items (positive -> right)
  function scrollByItems(n: number) {
    const container = containerRef.current;
    const itemW = singleWidthRef.current || 0;
    if (!container || itemW === 0) return;
    container.scrollBy({ left: n * itemW, behavior: "smooth" });
  }

  // make wheel also scroll horizontally (shift+wheel or normal wheel)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // if vertical wheel, convert to horizontal
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        // prefer horizontal scrolling for the carousel
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // mark when user is interacting (to disable auto behaviors in later steps)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onPointerDown = () => (isUserInteractingRef.current = true);
    const onPointerUp = () => (isUserInteractingRef.current = false);

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">24-hour Carousel</h2>

        <div className="flex gap-2">
          <button
            onClick={() => scrollByItems(-1)}
            aria-label="Scroll left"
            className="px-3 py-1 rounded-md border bg-white hover:shadow-sm"
          >
            ←
          </button>
          <button
            onClick={() => scrollByItems(1)}
            aria-label="Scroll right"
            className="px-3 py-1 rounded-md border bg-white hover:shadow-sm"
          >
            →
          </button>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        role="list"
        tabIndex={0}
        aria-label="Hours carousel. Use left and right arrow keys to navigate."
        className="relative w-full overflow-x-auto scroll-smooth touch-pan-x no-scrollbar"
        // tailwind: hide default scrollbar via custom class (no-scrollbar). Add this class in your CSS if you want:
        // .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex gap-3 items-stretch px-3 py-4">
          {tripled.map((h, idx) => {
            const { display, ampm } = hourLabel(h);
            // the middle copy has the "real" index in the middle area; but we don't need to show anything different now
            const key = `${h}-${idx}`;
            // set ref on the first rendered item so we can measure size
            const setRef = idx === 0 ? (el: HTMLButtonElement | null) => { itemRef.current = el; } : undefined;

            return (
              <button
                role="listitem"
                aria-label={`${display} ${ampm}`}
                ref={setRef}
                key={key}
                className="min-w-[84px] sm:min-w-[100px] lg:min-w-[120px] h-28 flex-shrink-0 rounded-xl bg-white border shadow-sm flex flex-col items-center justify-center p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                // we intentionally keep these simple; later we can add active/highlight states
              >
                <div className="text-2xl font-bold leading-none">{display}</div>
                <div className="text-sm text-gray-500">{ampm}</div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Scroll horizontally, drag on touch, or use the ← → buttons / arrow keys. Infinite scroll is
        implemented by duplicating the 24 items and re-centering when you reach the ends.
      </p>
    </div>
  );
}
