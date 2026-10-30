"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TONE_HEX } from "@/components/dashboard/tone";

// Chart colours (docs/GUI_RULES.md §2): rose bars for everyone who joined,
// brand bars for those served, amber line for the average wait.
const JOINED = TONE_HEX.rose;
const SERVED = TONE_HEX.brand;
const WAIT = TONE_HEX.amber;

// Grid, axes, tick labels and the hover band take the theme's border, muted
// text and muted background tokens through CSS, so the chart follows the
// palette without colour values of its own.
const CHART_THEME = [
  "[&_.recharts-cartesian-grid_line]:stroke-border",
  "[&_.recharts-cartesian-axis-line]:stroke-border",
  "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
  "[&_.recharts-tooltip-cursor]:fill-muted",
].join(" ");

export type DailyPoint = {
  label: string;
  joined: number;
  completed: number;
  noShows: number;
  averageWaitMinutes: number | null;
};

const SERIES_NAMES: Record<string, string> = {
  joined: "Joined",
  completed: "Served",
  noShows: "No-shows",
  averageWaitMinutes: "Average wait",
};

// Patients per day (paired bars) and average wait (line, right axis).
export function DailyActivityChart({
  data,
  height = 260,
}: {
  data: DailyPoint[];
  height?: number;
}) {
  const totals = data.reduce(
    (sum, day) => ({
      joined: sum.joined + day.joined,
      completed: sum.completed + day.completed,
    }),
    { joined: 0, completed: 0 },
  );
  return (
    <figure className={`flex flex-col gap-3 ${CHART_THEME}`}>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-rose" />
          Joined
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-brand" /> Served
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-tone-amber" />{" "}
          Average wait (min)
        </span>
        <span className="sr-only">
          {totals.joined} joined and {totals.completed} served over{" "}
          {data.length} days. The table below has the same numbers.
        </span>
      </figcaption>
      <ComposedChart
        responsive
        data={data}
        barGap={4}
        margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
        style={{ width: "100%", height }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine
          minTickGap={12}
        />
        <YAxis
          yAxisId="count"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="wait"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            borderColor: "var(--border)",
            fontSize: 12,
          }}
          formatter={(value, name) => [
            name === "averageWaitMinutes" ? `${value} min` : value,
            SERIES_NAMES[String(name)] ?? name,
          ]}
        />
        <Bar
          yAxisId="count"
          dataKey="joined"
          fill={JOINED}
          maxBarSize={14}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="count"
          dataKey="completed"
          fill={SERVED}
          maxBarSize={14}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="wait"
          type="monotone"
          dataKey="averageWaitMinutes"
          stroke={WAIT}
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </figure>
  );
}
