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

// Brand chart colours (docs/GUI_RULES.md §2).
const SLATE = "#475c6c";
const SAND = "#eed7a1";
const TERRACOTTA = "#cd8b62";
const LINE = "#e9e2d0";
const MUTED = "#5f5a57";

export type DailyPoint = {
  label: string;
  joined: number;
  completed: number;
  noShows: number;
  averageWaitMinutes: number | null;
};

const SERIES_NAMES: Record<string, string> = {
  joined: "Joined",
  completed: "Completed",
  noShows: "No-shows",
  averageWaitMinutes: "Average wait",
};

// Patients per day (bars) and average wait (terracotta line).
export function DailyActivityChart({ data }: { data: DailyPoint[] }) {
  const totals = data.reduce(
    (sum, day) => ({
      joined: sum.joined + day.joined,
      completed: sum.completed + day.completed,
    }),
    { joined: 0, completed: 0 },
  );
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-slate" /> Joined
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-sand" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-terracotta" />{" "}
          Average wait (min)
        </span>
        <span className="sr-only">
          {totals.joined} joined and {totals.completed} completed over{" "}
          {data.length} days. The table below has the same numbers.
        </span>
      </figcaption>
      <ComposedChart
        responsive
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
        style={{ width: "100%", height: 240 }}
      >
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: MUTED, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: LINE }}
          minTickGap={12}
        />
        <YAxis
          yAxisId="count"
          allowDecimals={false}
          tick={{ fill: MUTED, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="wait"
          orientation="right"
          allowDecimals={false}
          tick={{ fill: MUTED, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 10, borderColor: LINE, fontSize: 12 }}
          formatter={(value, name) => [
            name === "averageWaitMinutes" ? `${value} min` : value,
            SERIES_NAMES[String(name)] ?? name,
          ]}
        />
        <Bar
          yAxisId="count"
          dataKey="joined"
          fill={SLATE}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="count"
          dataKey="completed"
          fill={SAND}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="wait"
          type="monotone"
          dataKey="averageWaitMinutes"
          stroke={TERRACOTTA}
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </figure>
  );
}
