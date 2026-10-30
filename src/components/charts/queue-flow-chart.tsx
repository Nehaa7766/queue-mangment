"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Brand chart colours (docs/GUI_RULES.md §2).
const SLATE = "#475c6c";
const SLATE_TINT = "#e6ecf0";
const TERRACOTTA = "#cd8b62";
const LINE = "#e9e2d0";
const MUTED = "#5f5a57";

export type QueueFlowPoint = {
  hour: string;
  waiting: number;
  averageWaitMinutes: number | null;
};

// Patients waiting (slate line, light fill) and average wait in minutes
// (terracotta line) per hour today (docs/PLAN.md §12.7).
export function QueueFlowChart({ data }: { data: QueueFlowPoint[] }) {
  const latest = data.at(-1);
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-slate" /> Patients
          waiting
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-terracotta" />{" "}
          Average wait (min)
        </span>
        {latest && (
          <span className="sr-only">
            At {latest.hour}: {latest.waiting} waiting
            {latest.averageWaitMinutes !== null &&
              `, average wait ${latest.averageWaitMinutes} minutes`}
            .
          </span>
        )}
      </figcaption>
      <ComposedChart
        responsive
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
        style={{ width: "100%", height: 220 }}
      >
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fill: MUTED, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: LINE }}
        />
        <YAxis
          yAxisId="waiting"
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
          formatter={(value, name) =>
            name === "averageWaitMinutes"
              ? [`${value} min`, "Average wait"]
              : [value, "Waiting"]
          }
        />
        <Area
          yAxisId="waiting"
          type="monotone"
          dataKey="waiting"
          stroke={SLATE}
          strokeWidth={2}
          fill={SLATE_TINT}
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
