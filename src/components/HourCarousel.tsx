import React, { useEffect, useRef, useState } from "react";

export type ScheduleId = "16/8" | "20/4" | null;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number) {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return { display: `${hour12}`, ampm };
}

/**
 * Props:
 * - schedule: which fasting schedule the user chose (null if none)
 * - resetSignal: integer incremented by parent to force a hard reset (re-center)
 */
interface Props {
  schedule: ScheduleId;
  resetSignal: number;
}

export default function HourCarousel({ schedule, resetSignal }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLButtonElement | null>(null);
  const singleWidthRef = useRef<number>(0);
  const totalSingleWidthRef = useRef<number>(0);

  // user state
  const [lastEatenHour, setLastEatenHour] = useState<number | null>(null);
  const [nextMealHour, setNextMealHour] = useState<number | null>(null);

  // animation / reveal state for the highlighted target card
  const [isBouncing, setIsBouncing] = useState(false);
  const bounceTimerRef = useRef<number | null>(null);
  const [revealedEmojis, setRevealedEmojis] = useState<Record<number, { icons: string[]; positions: { top: number; left: number }[] }>>({});

  const tripled = [...HOURS, ...HOURS, ...HOURS];

  // Measure an item width and center on mount (middle copy)
  useEffect(() => {
    const container = containerRef.current;
    const item = itemRef.current;
    if (!container || !item) return;

    const measure = () => {
      const itemW = item.getBoundingClientRect().width + parseFloat(getComputedStyle(item).marginRight || "0");
      singleWidthRef.current = itemW;
      totalSingleWidthRef.current = itemW * HOURS.length;

      // center on middle copy
      container.scrollLeft = totalSingleWidthRef.current;
    };

    measure();
    const t = setTimeout(measure, 50);
    return () => clearTimeout(t);
  }, [resetSignal]); // re-measure on reset signal too

  // helper: compute fasting hours from schedule id
  const fastingHoursFromSchedule = (s: ScheduleId) => {
    if (s === "16/8") return 16;
    if (s === "20/4") return 20;
    return 0;
  };

  // scroll to a specific hour (0..23) in the middle copy, centering it
  const scrollToHour = (hour: number, behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    const itemW = singleWidthRef.current;
    if (!container || itemW === 0) return;

    // index in the tripled array that corresponds to the middle copy
    const index = HOURS.length + hour;
    // compute left so card at index is centered
    const left = index * itemW - (container.clientWidth - itemW) / 2;
    container.scrollTo({ left, behavior });
  };

  // When user clicks a card to indicate last eaten hour
  const onCardClick = (hour: number) => {
    setLastEatenHour(hour);

    // if no schedule chosen, we can't compute next meal — just set nextMealHour null
    if (!schedule) {
      setNextMealHour(null);
      return;
    }

    const fastingHours = fastingHoursFromSchedule(schedule);
    const next = (hour + fastingHours) % 24;
    setNextMealHour(next);

    // scroll to that next hour (center)
    // small timeout to ensure measurement occurred
    setTimeout(() => scrollToHour(next, "smooth"), 80);

    // start bounce for 60 seconds (unless user clicks to reveal)
    startBounceForMinute(next);
  };

  // Start bounce animation for the target hour for 60 seconds
  const startBounceForMinute = (hour: number) => {
    // clear any existing
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }
    setIsBouncing(true);

    // after 60 secs turn off bouncing automatically
    bounceTimerRef.current = window.setTimeout(() => {
      setIsBouncing(false);
      bounceTimerRef.current = null;
    }, 60_000);
  };

  // when user clicks the highlighted next-meal card: reveal emojis and stop bounce
  const onTargetCardClick = (hour: number) => {
    // stop bouncing
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }
    setIsBouncing(false);

    // create random emojis and positions
    const pool = ["🍗", "🍖", "🍲", "🍫", "🍌", "🍇", "🥗", "🍎", "🍞", "🧀"];
    const count = 6;
    const icons: string[] = Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
    const positions = icons.map(() => ({ top: Math.floor(Math.random() * 72) + 8, left: Math.floor(Math.random() * 72) + 8 }));

    setRevealedEmojis((prev) => ({ ...prev, [hour]: { icons, positions } }));
  };

  // Reset handler (clear selections and recenters to the middle copy)
  const doReset = () => {
    // clear state
    setLastEatenHour(null);
    setNextMealHour(null);
    setIsBouncing(false);
    setRevealedEmojis({});
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }

    // re-center container to middle copy
    const container = containerRef.current;
    if (!container || singleWidthRef.current === 0) return;
    container.scrollTo({ left: totalSingleWidthRef.current, behavior: "smooth" });
  };

  // If schedule becomes null (user deselects), clear next meal state
  useEffect(() => {
    if (!schedule) {
      setNextMealHour(null);
      setLastEatenHour(null);
      setIsBouncing(false);
      setRevealedEmojis({});
      if (bounceTimerRef.current) {
        window.clearTimeout(bounceTimerRef.current);
        bounceTimerRef.current = null;
      }
    }
  }, [schedule]);

  // Also recenter when parent sends a resetSignal prop (App will bump that on Reset)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || singleWidthRef.current === 0) return;
    container.scrollTo({ left: totalSingleWidthRef.current, behavior: "smooth" });
  }, [resetSignal]);

  return (
    <div className="w-full">
      {/* Instruction text above the carousel */}
      <p className="mb-3 text-sm text-gray-700">
        Select the hour in which you <strong>last</strong> ate and we will show you when you should be
        eating again based on your fasting schedule.
      </p>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">24-hour Carousel</h2>

        <div className="flex gap-2">
          <button
            onClick={() => {
              // move left by one hour
              const container = containerRef.current;
              if (!container) return;
              container.scrollBy({ left: -(singleWidthRef.current || 0), behavior: "smooth" });
            }}
            aria-label="Scroll left"
            className="px-3 py-1 rounded-md border bg-white hover:shadow-sm"
          >
            ←
          </button>
          <button
            onClick={() => {
              const container = containerRef.current;
              if (!container) return;
              container.scrollBy({ left: singleWidthRef.current || 0, behavior: "smooth" });
            }}
            aria-label="Scroll right"
            className="px-3 py-1 rounded-md border bg-white hover:shadow-sm"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        role="list"
        tabIndex={0}
        aria-label="Hours carousel. Use left and right arrow keys to navigate."
        className="relative w-full overflow-x-auto scroll-smooth touch-pan-x no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 items-stretch px-3 py-4">
          {tripled.map((h, idx) => {
            const { display, ampm } = hourLabel(h);
            const key = `${h}-${idx}`;
            const isTarget = nextMealHour === h && idx >= HOURS.length && idx < HOURS.length * 2; // target appears in middle copy
            const isTargetIndex = nextMealHour === h && idx === HOURS.length + h;
            const isSelectedAsLast = lastEatenHour === h && idx >= HOURS.length && idx < HOURS.length * 2;

            // on the very first rendered item we attach itemRef for measurement
            const setRef = idx === 0 ? (el: HTMLButtonElement | null) => (itemRef.current = el) : undefined;

            // if this is the exact middle-copy target, add green border & bounce when active
            const borderClass = isTarget ? "border-green-500" : "border-gray-200";
            const bounceClass = isTarget && isBouncing ? "animate-bounce" : "";

            // show emojis if this hour has reveal data
            const reveal = revealedEmojis[h];

            return (
              <button
                role="listitem"
                aria-label={`${display} ${ampm}`}
                ref={setRef}
                key={key}
                onClick={() => {
                  // if this is the target card (next meal), reveal emojis and stop bounce
                  if (nextMealHour === h && idx === HOURS.length + h) {
                    onTargetCardClick(h);
                    return;
                  }

                  // otherwise interpret as selecting the last eaten hour
                  onCardClick(h);
                }}
                className={`relative min-w-[84px] sm:min-w-[100px] lg:min-w-[120px] h-28 flex-shrink-0 rounded-xl bg-white border ${borderClass} shadow-sm flex flex-col items-center justify-center p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${bounceClass}`}
              >
                <div className="text-2xl font-bold leading-none">{display}</div>
                <div className="text-sm text-gray-500">{ampm}</div>

                {/* small badge for "you selected this as last eaten" (in middle copy) */}
                {isSelectedAsLast && (
                  <div className="absolute top-2 right-2 text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full">Last</div>
                )}

                {/* Emoji reveal: randomly positioned icons inside the card */}
                {reveal && (
                  <div className="pointer-events-none absolute inset-0">
                    {reveal.icons.map((ic, i) => (
                      <span
                        key={i}
                        style={{
                          position: "absolute",
                          top: `${reveal.positions[i].top}%`,
                          left: `${reveal.positions[i].left}%`,
                          transform: "translate(-50%,-50%)",
                          fontSize: "18px",
                        }}
                        aria-hidden
                      >
                        {ic}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={doReset}
          className="px-4 py-2 rounded-md bg-white border hover:shadow-sm"
          aria-label="Reset app"
        >
          Reset
        </button>

        {/* Small status text */}
        <div className="text-sm text-gray-600">
          {lastEatenHour === null ? (
            <>No hour selected yet.</>
          ) : nextMealHour === null ? (
            <>Pick a fasting schedule to compute next meal.</>
          ) : (
            <>
              Last ate at <span className="font-medium">{`${lastEatenHour % 12 === 0 ? 12 : lastEatenHour % 12}${lastEatenHour < 12 ? "AM" : "PM"}`}</span>.
              Next meal at <span className="font-medium text-green-600">{`${nextMealHour % 12 === 0 ? 12 : nextMealHour % 12}${nextMealHour < 12 ? "AM" : "PM"}`}</span>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
