"use client";

import { Area, AreaChart, YAxis } from "recharts";

// Headroom above the highest value, so a flat series draws a line part-way up
// instead of filling the whole chart.
const Y_DOMAIN: [number, (dataMax: number) => number] = [
  0,
  (dataMax) => (dataMax > 0 ? dataMax * 1.4 : 1),
];

// The chart part of SparkCard. Only this runs on the client, so server pages
// can pass SparkCard an icon component. Shape only: hidden from screen readers.
export function Sparkline({
  series,
  color,
  height = 64,
}: {
  series: number[];
  color: string;
  height?: number;
}) {
  const data = (series.length > 1 ? series : [0, 0]).map((v, i) => ({
    i,
    v,
  }));
  return (
    <AreaChart
      responsive
      accessibilityLayer={false}
      data={data}
      margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
      style={{ width: "100%", height }}
    >
      <YAxis hide domain={Y_DOMAIN} />
      <Area
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={2}
        fill={color}
        fillOpacity={0.12}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
