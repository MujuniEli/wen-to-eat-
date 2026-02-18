import { useEffect, useRef, useState } from "react";

export type ScheduleId = "16/8" | "20/4" | null;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number) {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return { display: `${hour12}`, ampm };
}

interface Props {
  schedule: ScheduleId;
  resetSignal: number;
}

/**
 * HourCarousel
 * - Props:
 *    - schedule: "16/8" | "20/4" | null
 *    - resetSignal: bump this (number) to force a reset/remeasure from parent
 *
 * Behavior:
 * - Click a card to mark "last eaten hour" (requires schedule to compute next).
 * - Computes next = (last + fastingHours) % 24 and scrolls the middle copy of that hour
 *   to the exact viewport center.
 * - Bounces the target card for 60s (stops when user clicks the target; clicking reveals emojis).
 * - Snap-to-center after user scroll stops (debounced).
 * - Infinite-look via tripled array; re-centering guarded to avoid loops.
 */
export default function HourCarousel({ schedule, resetSignal }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLButtonElement | null>(null); // for measuring card width

  const itemWidthRef = useRef<number>(0);
  const singleCopyWidthRef = useRef<number>(0);

  const isProgrammaticScrollRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);
  const bounceTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const [lastEatenHour, setLastEatenHour] = useState<number | null>(null);
  const [nextMealHour, setNextMealHour] = useState<number | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const [revealedEmojis, setRevealedEmojis] = useState<Record<number, { icons: string[]; positions: { top: number; left: number }[] }>>({});

  const tripled = [...HOURS, ...HOURS, ...HOURS];

  // map schedule id to fasting hours
  const fastingHoursFromSchedule = (s: ScheduleId) => {
    if (s === "16/8") return 16;
    if (s === "20/4") return 20;
    return 0;
  };

  // ---------- Measure item width and set initial middle-copy scroll ----------
  useEffect(() => {
    const container = containerRef.current;
    const item = itemRef.current;
    if (!container || !item) return;

    const measure = () => {
      const rect = item.getBoundingClientRect();
      // estimate gap from parent flex gap (fallback to 12px)
      let gap = 12;
      if (item.parentElement) {
        const parentStyle = getComputedStyle(item.parentElement);
        const g = parseFloat(parentStyle.gap || parentStyle.columnGap || "12");
        if (!Number.isNaN(g)) gap = g;
      }
      const w = rect.width + gap;
      itemWidthRef.current = w;
      singleCopyWidthRef.current = w * HOURS.length;

      // set middle copy scroll exactly (programmatic)
      isProgrammaticScrollRef.current = true;
      container.scrollLeft = singleCopyWidthRef.current;
      // clear programmatic flag next frame
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    };

    measure();
    const t = window.setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [resetSignal]);

  // ---------- helper: compute scrollLeft to exactly center a given tripled index ----------
  const computeScrollLeftForIndex = (index: number) => {
    const w = itemWidthRef.current || 0;
    const container = containerRef.current;
    if (!container) return 0;
    return index * w - (container.clientWidth - w) / 2;
  };

  // center a given hour (0..23) using the middle copy (index = HOURS.length + hour)
  const centerHourInViewport = (hour: number, behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    const w = itemWidthRef.current;
    if (!container || !w) return;
    const index = HOURS.length + hour;
    const left = computeScrollLeftForIndex(index);

    // mark programmatic while we set scroll to avoid feedback loops
    isProgrammaticScrollRef.current = true;
    container.scrollTo({ left, behavior });

    // clear flag after a couple of frames to be safe
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });
  };

  // ---------- click handling: choose last-eaten or reveal target ----------
  const handleCardClick = (hour: number, idx: number) => {
    // if user clicked the exact middle-copy target card, treat as reveal
    if (nextMealHour === hour && idx === HOURS.length + hour) {
      revealEmojis(hour);
      stopBounce();
      return;
    }

    // otherwise mark last-eaten
    setLastEatenHour(hour);
    if (!schedule) {
      setNextMealHour(null);
      return;
    }
    const fasting = fastingHoursFromSchedule(schedule);
    const next = (hour + fasting) % 24;
    setNextMealHour(next);

    // center exact pixel center
    centerHourInViewport(next, "smooth");

    // start bounce for 60s
    startBounce(next);
  };

  // ---------- Bounce & reveal ----------
  const startBounce = (hour: number) => {
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }
    setIsBouncing(true);
    bounceTimerRef.current = window.setTimeout(() => {
      setIsBouncing(false);
      bounceTimerRef.current = null;
    }, 60_000);
  };

  const stopBounce = () => {
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }
    setIsBouncing(false);
  };

  const revealEmojis = (hour: number) => {
    stopBounce();
    // generate positions and emoji list
    const pool = ["🍗", "🍖", "🍲", "🍫", "🍌", "🍇", "🥗", "🍎", "🍞", "🧀"];
    const count = 6;
    const icons = Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
    const positions = icons.map(() => ({ top: Math.floor(Math.random() * 80) + 5, left: Math.floor(Math.random() * 80) + 5 }));
    setRevealedEmojis((p) => ({ ...p, [hour]: { icons, positions } }));
  };

  // ---------- Snap-to-center after user scroll stops (debounced) ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const SNAP_MS = 120;

    const runSnap = () => {
      // don't snap while we programmatically scroll
      if (isProgrammaticScrollRef.current) return;
      const w = itemWidthRef.current;
      if (!w) return;
      // compute approximate index that should be centered
      const left = container.scrollLeft;
      const approxIndex = Math.round((left + (container.clientWidth - w) / 2) / w);
      // map to an hour (0..23)
      const hour = ((approxIndex % HOURS.length) + HOURS.length) % HOURS.length;
      // center that hour (exact viewport center)
      centerHourInViewport(hour, "smooth");
    };

    const onScroll = () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
      snapTimeoutRef.current = window.setTimeout(runSnap, SNAP_MS);
    };

    // avoid snapping while dragging
    const onPointerDown = () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
    const onPointerUp = () => {
      // short delay then snap
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
      snapTimeoutRef.current = window.setTimeout(runSnap, 60);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, []);

  // ---------- Prevent infinite recenter feedback loop (guarded infinite illusion) ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = () => {
      if (isProgrammaticScrollRef.current) return;
      const single = singleCopyWidthRef.current;
      if (!single || single === 0) return;
      const left = container.scrollLeft;
      // if we've scrolled beyond the middle copy, shift by exactly one copy without triggering loop
      if (left < single * 0.5) {
        isProgrammaticScrollRef.current = true;
        container.scrollLeft = left + single;
        requestAnimationFrame(() => (isProgrammaticScrollRef.current = false));
      } else if (left > single * 1.5) {
        isProgrammaticScrollRef.current = true;
        container.scrollLeft = left - single;
        requestAnimationFrame(() => (isProgrammaticScrollRef.current = false));
      }
    };

    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, []);

  // ---------- Keyboard left/right navigation ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        container.scrollBy({ left: -(itemWidthRef.current || 0), behavior: "smooth" });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        container.scrollBy({ left: itemWidthRef.current || 0, behavior: "smooth" });
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, []);

  // ---------- Wheel -> horizontal behavior ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // ---------- Reset handler ----------
  const doReset = () => {
    setLastEatenHour(null);
    setNextMealHour(null);
    setIsBouncing(false);
    setRevealedEmojis({});
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }
    const container = containerRef.current;
    const w = itemWidthRef.current || 0;
    if (!container || w === 0) return;
    // immediate recenter to middle copy
    isProgrammaticScrollRef.current = true;
    container.scrollLeft = singleCopyWidthRef.current;
    requestAnimationFrame(() => (isProgrammaticScrollRef.current = false));
  };

  // Clear selection when schedule becomes null
  useEffect(() => {
    if (!schedule) {
      setLastEatenHour(null);
      setNextMealHour(null);
      setIsBouncing(false);
      setRevealedEmojis({});
      if (bounceTimerRef.current) {
        window.clearTimeout(bounceTimerRef.current);
        bounceTimerRef.current = null;
      }
    }
  }, [schedule]);

  // Respond to parent resetSignal: re-measure and recenter
  useEffect(() => {
    const container = containerRef.current;
    const item = itemRef.current;
    if (!container || !item) return;
    const rect = item.getBoundingClientRect();
    let gap = 12;
    if (item.parentElement) {
      const parentStyle = getComputedStyle(item.parentElement);
      const g = parseFloat(parentStyle.gap || parentStyle.columnGap || "12");
      if (!Number.isNaN(g)) gap = g;
    }
    const w = rect.width + gap;
    itemWidthRef.current = w;
    singleCopyWidthRef.current = w * HOURS.length;

    // center programmatically
    isProgrammaticScrollRef.current = true;
    container.scrollLeft = singleCopyWidthRef.current;
    requestAnimationFrame(() => (isProgrammaticScrollRef.current = false));
  }, [resetSignal]);

  // cleanup timers/rafs on unmount
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
      if (bounceTimerRef.current) window.clearTimeout(bounceTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---------- Render ----------
  return (
    <div className="w-full bg-cream p-3 rounded-xl border border-secondary">
      {/* Instruction */}
      <p className="mb-3 text-sm text-primary text-center">
        Select the hour in which you <strong>last</strong> ate and we will show you when you should be eating again.
      </p>

      <div className="flex items-center justify-between mb-2">
        
        <div className="flex gap-2">
          <button
            aria-label="scroll left"
            onClick={() => {
              const c = containerRef.current;
              if (!c) return;
              isProgrammaticScrollRef.current = true;
              c.scrollBy({ left: -(itemWidthRef.current || 0), behavior: "smooth" });
              requestAnimationFrame(() => (isProgrammaticScrollRef.current = false));
            }}
            className="px-3 py-1 rounded-md border border-secondary bg-white hover:shadow-sm text-primary"
          >
            ←
          </button>
          <button
            aria-label="scroll right"
            onClick={() => {
              const c = containerRef.current;
              if (!c) return;
              isProgrammaticScrollRef.current = true;
              c.scrollBy({ left: itemWidthRef.current || 0, behavior: "smooth" });
              requestAnimationFrame(() => (isProgrammaticScrollRef.current = false));
            }}
            className="px-3 py-1 rounded-md border border-secondary bg-white hover:shadow-sm text-primary"
          >
            →
          </button>
        </div>
      </div>

      {/* Carousel container */}
      <div
        ref={containerRef}
        role="list"
        tabIndex={0}
        aria-label="Hours carousel. Use left/right arrow keys to navigate."
        className="relative w-full overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 px-3 py-4">
          {tripled.map((h, idx) => {
            const { display, ampm } = hourLabel(h);
            const key = `${h}-${idx}`;

            const isMiddleCopy = idx >= HOURS.length && idx < HOURS.length * 2;
            const actualHour = h % 24;

            const isTarget = nextMealHour === actualHour && idx === HOURS.length + actualHour; // exact middle copy match
            const isSelectedAsLast = lastEatenHour === actualHour && isMiddleCopy;

            // set itemRef on first element for measurement
            const setRef = idx === 0 ? (el: HTMLButtonElement | null) => (itemRef.current = el) : undefined;

            // theme classes: normal = cream bg + subtle secondary border; target = bold primary border + bounce
            const baseBorder = "border-secondary/40";
            const lastBorder = "border-secondary";
            const targetBorder = "border-primary";

            const borderClass = isTarget ? `border-4 ${targetBorder}` : isSelectedAsLast ? `border-2 ${lastBorder}` : `border ${baseBorder}`;
            const bounceClass = isTarget && isBouncing ? "animate-bounce" : "";

            const reveal = revealedEmojis[actualHour];

            return (
              <button
                key={key}
                ref={setRef}
                onClick={() => handleCardClick(actualHour, idx)}
                role="listitem"
                aria-label={`${display} ${ampm}`}
                className={`min-w-[84px] sm:min-w-[100px] lg:min-w-[120px] h-28 flex-shrink-0 rounded-xl bg-cream ${borderClass} shadow-sm flex flex-col items-center justify-center p-2 focus:outline-none focus:ring-2 focus:ring-primary ${bounceClass}`}
              >
                {/* Top-left "Last" badge if user marked this as last (middle copy) */}
                {isSelectedAsLast && (
                  <div className="absolute left-auto right-2 top-2 text-xs px-2 py-0.5 bg-secondary text-white rounded-full">Last</div>
                )}

                {!reveal ? (
                  <>
                    <div className="text-2xl font-bold text-primary leading-none">{display}</div>
                    <div className="text-sm text-secondary">{ampm}</div>
                  </>
                ) : (
                  // emoji reveal overlay (random positions)
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full">
                      {reveal.icons.map((ic, i) => (
                        <span
                          key={i}
                          style={{
                            position: "absolute",
                            top: `${reveal.positions[i].top}%`,
                            left: `${reveal.positions[i].left}%`,
                            transform: "translate(-50%, -50%)",
                            fontSize: "18px",
                          }}
                        >
                          {ic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer: Reset & status */}
      <div className="mt-4 flex items-center gap-3 justify-between">
        <button
          onClick={doReset}
          className="px-4 py-2 rounded-md bg-primary text-white hover:bg-secondary transition-colors"
        >
          Reset
        </button>

        <div className="text-sm text-primary/90">
          {lastEatenHour === null ? (
            <>No hour selected yet.</>
          ) : nextMealHour === null ? (
            <>Pick a fasting schedule to compute next meal.</>
          ) : (
            <>
              Last ate at <span className="font-medium">{`${lastEatenHour % 12 === 0 ? 12 : lastEatenHour % 12}${lastEatenHour < 12 ? "AM" : "PM"}`}</span>.
              Next meal at <span className="font-medium text-primary">{`${nextMealHour % 12 === 0 ? 12 : nextMealHour % 12}${nextMealHour < 12 ? "AM" : "PM"}`}</span>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
