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
import type { GrowthPoint } from "@/features/platform/analytics-shape";
import {
  AXIS_TICK,
  CHART_WRAPPER,
  GRID_PROPS,
  HOVER_CURSOR,
  SERIES_COMPARE,
  SERIES_LINE,
  SERIES_MAIN,
  TOOLTIP_STYLE,
} from "./chart-theme";
import { ChartLegend } from "./legend";

// New sign-ups (mocha) and approvals (tan) per bucket, with active clinics
// as a rose line on its own scale. Totals are in the card's footer.
export function ClinicGrowthChart({ points }: { points: GrowthPoint[] }) {
  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        items={[
          { label: "New sign-ups", color: SERIES_MAIN },
          { label: "Approved", color: SERIES_COMPARE },
          { label: "Active clinics", color: SERIES_LINE, shape: "line" },
        ]}
      />
      <div aria-hidden className={CHART_WRAPPER}>
        <ComposedChart
          responsive
          accessibilityLayer={false}
          data={points}
          barGap={3}
          margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
          style={{ width: "100%", height: 260 }}
        >
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            yAxisId="count"
            allowDecimals={false}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <YAxis
            yAxisId="active"
            orientation="right"
            allowDecimals={false}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={HOVER_CURSOR} />
          <Bar
            yAxisId="count"
            dataKey="signups"
            name="New sign-ups"
            fill={SERIES_MAIN}
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="count"
            dataKey="approved"
            name="Approved"
            fill={SERIES_COMPARE}
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Line
            yAxisId="active"
            dataKey="active"
            name="Active clinics"
            type="monotone"
            stroke={SERIES_LINE}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </div>
    </div>
  );
}
