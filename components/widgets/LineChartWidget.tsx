"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_AXIS_COLOR, CHART_COLORS, CHART_GRID_COLOR } from "@/lib/chartTheme";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { WidgetContentProps } from "@/types/dashboard";

import styles from "./ChartWidget.module.css";

export default function LineChartWidget({ data }: WidgetContentProps) {
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={140}>
        <LineChart data={data.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
            width={48}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[1]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS[1] }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
