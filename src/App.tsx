import { useState } from "react";
import ScheduleSelector from "./components/ScheduleSelector";
import type { FastingSchedule } from "./components/ScheduleSelector";
import HourCarousel from "./components/HourCarousel";

export default function App() {
  const [schedule, setSchedule] = useState<FastingSchedule>(null);

  // simple counter we bump to tell the carousel to re-center / reset measurements
  const [resetSignal, setResetSignal] = useState(0);

  const doAppReset = () => {
    // reset schedule as well to restart the app fresh (you asked the reset to restart the app)
    setSchedule(null);
    // bump resetSignal to let carousel reposition
    setResetSignal((n) => n + 1);
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-[#FCF8EF] p-6">
      <div className="max-w-3xl w-full space-y-6">
        <header>
          <h1 className="text-2xl font-bold mb-2">When should I have my next meal?</h1>
          <p className="text-sm text-gray-600">Pick a fasting schedule then tap the hour you last ate.</p>
        </header>

        <div>
          <ScheduleSelector value={schedule} onChange={(s) => setSchedule(s)} />
        </div>

        <div>
          {/* Pass schedule and resetSignal into the carousel */}
          <HourCarousel schedule={schedule} resetSignal={resetSignal} />
        </div>

        {/* Global app-level reset */}
        <div className="pt-4 border-t">
          <button
            onClick={doAppReset}
            className="px-4 py-2 rounded-md bg-red-50 text-red-700 border hover:shadow-sm"
          >
            Reset App
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Reset clears selections and recenters the carousel. The app also starts fresh on reload.
          </p>
        </div>
      </div>
    </div>
  );
}