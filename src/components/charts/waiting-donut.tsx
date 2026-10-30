"use client";

import { Pie, PieChart } from "recharts";

// Donut segment order from docs/PLAN.md §12.7.
const COLOURS = ["#475c6c", "#cd8b62", "#eed7a1", "#8a8583", "#2a2d34"];

export type DonutSlice = { label: string; value: number };

// Waiting patients by service, with the total in the centre and a legend
// that repeats every count as text.
export function WaitingDonut({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const data = slices.map((slice, index) => ({
    ...slice,
    fill: COLOURS[index % COLOURS.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-[150px] shrink-0">
        {total > 0 ? (
          <PieChart
            responsive
            style={{ width: 150, height: 150 }}
            accessibilityLayer={false}
          >
            <Pie
              data={data.filter((slice) => slice.value > 0)}
              dataKey="value"
              nameKey="label"
              innerRadius={48}
              outerRadius={72}
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </PieChart>
        ) : (
          <div
            aria-hidden
            className="size-full rounded-full border-[24px] border-cream"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">waiting</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.fill }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="font-semibold tabular-nums">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
