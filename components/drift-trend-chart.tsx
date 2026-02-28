"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatScore } from "@/lib/format";

type DriftTrendPoint = {
  time: string;
  ratio: number;
  runId: string;
};

type DriftTrendChartProps = {
  data: DriftTrendPoint[];
};

export default function DriftTrendChart({ data }: DriftTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-[#D1D5DB] bg-[#FAFAFA]">
        <p className="text-sm text-[#6B7280]">No trend data yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: "320px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="driftGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00A39B" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#00A39B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis dataKey="time" stroke="#6B7280" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 1]} stroke="#6B7280" tick={{ fontSize: 12 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) {
                return null;
              }
              const point = payload[0]?.payload as DriftTrendPoint;
              return (
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-md">
                  <p className="mb-1 text-xs text-[#6B7280]">{point.runId}</p>
                  <p className="text-sm font-bold text-nordea-navy">Drift: {formatScore(point.ratio)}</p>
                  <p className="text-xs text-[#6B7280]">{point.time}</p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={0.25}
            stroke="#EF4444"
            strokeDasharray="5 5"
            label={{ value: "Threshold", position: "right", fill: "#EF4444", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="ratio" stroke="#00A39B" strokeWidth={2} fill="url(#driftGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
