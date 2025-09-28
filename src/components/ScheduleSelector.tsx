import React from "react";

export type ScheduleId = "16/8" | "20/4";
export type FastingSchedule = ScheduleId | null;

interface Option {
  id: ScheduleId;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  { id: "16/8", label: "16 / 8", description: "Fast 16 hours · Eat 8 hours" },
  { id: "20/4", label: "20 / 4", description: "Fast 20 hours · Eat 4 hours" },
];

interface Props {
  value: FastingSchedule;
  onChange: (s: ScheduleId) => void;
}

/**
 * ScheduleSelector
 * - role="radiogroup" + role="radio" for accessibility
 * - only one option can be selected; onChange receives '16/8' or '20/4'
 */
export default function ScheduleSelector({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Choose fasting schedule" className="flex gap-4">
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;

        return (
          <div
            key={opt.id}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e: React.KeyboardEvent) => {
              // support Enter and Space to toggle selection
              if (e.key === "Enter" || e.code === "Space") {
                e.preventDefault();
                onChange(opt.id);
              }
            }}
            className={
              "cursor-pointer select-none rounded-lg border p-4 w-56 transition-shadow flex items-start gap-3 " +
              (selected
                ? "border-indigo-600 bg-indigo-50 shadow-md"
                : "border-gray-200 hover:shadow-sm")
            }
          >
            <div
              className={
                "flex-none w-9 h-9 rounded-full flex items-center justify-center " +
                (selected ? "bg-indigo-600 text-white" : "border border-gray-300 text-gray-600")
              }
            >
              {selected ? (
                /* check mark */
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                /* small dot when not selected (visual hint) */
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="12" r="2" />
                </svg>
              )}
            </div>

            <div className="text-left">
              <div className="font-semibold text-lg leading-tight">{opt.label}</div>
              <div className="text-sm text-gray-500">{opt.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
