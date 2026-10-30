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

// Chart colours from the brand palette (docs/GUI_RULES.md §2): mocha and tan
// bars, amber for the average-wait line, blush for grid lines and hover.
const JOINED = TONE_HEX.brand;
const SERVED = TONE_HEX.tan;
const WAIT = TONE_HEX.amber;
const GRID = TONE_HEX.blush;
// Axis text uses the theme's secondary text colour through a class, which
// overrides Recharts' default fill attribute.
const TICK = { fontSize: 12, className: "fill-muted-foreground" };

export type QueueFlowPoint = {
  hour: string;
  joined: number;
  served: number;
  averageWaitMinutes: number | null;
};

function LegendSwatch({ color, line }: { color: string; line?: boolean }) {
  return (
    <span
      aria-hidden
      className={line ? "h-0.5 w-4 rounded" : "size-2.5 rounded-sm"}
      style={{ backgroundColor: color }}
    />
  );
}

// Patients joined and served per hour today (paired bars), with the average
// wait in minutes as a line on the right axis.
export function QueueFlowChart({ data }: { data: QueueFlowPoint[] }) {
  const joined = data.reduce((sum, point) => sum + point.joined, 0);
  const served = data.reduce((sum, point) => sum + point.served, 0);
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <LegendSwatch color={JOINED} /> Joined
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LegendSwatch color={SERVED} /> Served
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LegendSwatch color={WAIT} line /> Average wait (min)
        </span>
        <span className="sr-only">
          Today: {joined} joined and {served} served across {data.length}{" "}
          {data.length === 1 ? "hour" : "hours"}.
        </span>
      </figcaption>
      <ComposedChart
        responsive
        data={data}
        barGap={4}
        barCategoryGap="28%"
        margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
        style={{ width: "100%", height: 260 }}
      >
        <CartesianGrid stroke={GRID} strokeOpacity={0.6} vertical={false} />
        <XAxis
          dataKey="hour"
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <YAxis
          yAxisId="count"
          allowDecimals={false}
          tick={TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="wait"
          orientation="right"
          allowDecimals={false}
          tick={TICK}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: TONE_HEX.blush, fillOpacity: 0.35 }}
          contentStyle={{
            borderRadius: 8,
            borderColor: "var(--color-border)",
            fontSize: 12,
          }}
          formatter={(value, name) => {
            if (name === "averageWaitMinutes") {
              return [`${value} min`, "Average wait"];
            }
            return [value, name === "joined" ? "Joined" : "Served"];
          }}
        />
        <Bar
          yAxisId="count"
          dataKey="joined"
          fill={JOINED}
          radius={[3, 3, 0, 0]}
          maxBarSize={14}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="count"
          dataKey="served"
          fill={SERVED}
          radius={[3, 3, 0, 0]}
          maxBarSize={14}
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
