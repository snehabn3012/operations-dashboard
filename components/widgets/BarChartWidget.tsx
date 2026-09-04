"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR } from "@/lib/chartTheme";
import { formatCount } from "@/lib/format";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./ChartWidget.module.css";

export default function BarChartWidget({ data }: WidgetContentProps) {
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={140}>
        <BarChart data={data.series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatCount(v)}
            width={40}
          />
          <Tooltip
            formatter={(value) => formatCount(Number(value))}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13 }}
          />
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
