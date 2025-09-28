import { useState } from "react";
import ScheduleSelector from "./components/ScheduleSelector";
import type { FastingSchedule } from "./components/ScheduleSelector";

export default function App() {
  const [schedule, setSchedule] = useState<FastingSchedule>(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full">
        <h1 className="text-2xl font-bold mb-4">Please choose a fasting schedule your following</h1>

        <ScheduleSelector value={schedule} onChange={(s) => setSchedule(s)} />

        <div className="mt-6 text-sm text-gray-700">
          Selected schedule:{" "}
          <span className="font-medium">{schedule ?? "None (pick one)"}</span>
        </div>
      </div>
    </div>
  );
}
