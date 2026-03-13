"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FeatureDriftMetric } from "@/lib/types";

type FeatureDriftChartProps = {
  metrics: FeatureDriftMetric[];
};

function getBarColor(metric: { drifted: boolean; severity: string | null }): string {
  if (!metric.drifted) return "#10B981";
  if (metric.severity === "high") return "#EF4444";
  return "#F59E0B";
}

export default function FeatureDriftChart({ metrics }: FeatureDriftChartProps) {
  if (!metrics.length) return null;

  const data = metrics.slice(0, 15).map((m) => ({
    name: m.feature_name.replace(/_/g, " "),
    score: m.score ?? 0,
    drifted: m.drifted,
    severity: m.severity,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 100, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(2)} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
          <ReferenceLine
            x={0.05}
            stroke="#6B7280"
            strokeDasharray="4 2"
            label={{ value: "p=0.05", position: "insideTopRight", fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number) => [value.toFixed(4), "Score"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
