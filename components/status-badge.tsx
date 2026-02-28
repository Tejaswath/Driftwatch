import type { DriftStatus, RunStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: RunStatus;
};

type DriftBadgeProps = {
  severity: DriftStatus | null;
};

type DriftIndicatorProps = {
  severity: DriftStatus | null;
  showLabel?: boolean;
};

type YesNoBadgeProps = {
  value: boolean;
};

const statusLabels: Record<RunStatus, string> = {
  completed: "Completed",
  processing: "Processing",
  failed: "Failed",
  queued: "Queued"
};

const statusClasses: Record<RunStatus, string> = {
  completed: "bg-status-completed text-white",
  processing: "bg-status-processing text-white",
  failed: "bg-status-failed text-white",
  queued: "bg-status-queued text-white"
};

const driftLabels: Record<DriftStatus, string> = {
  green: "No Drift",
  yellow: "Moderate",
  red: "High Drift"
};

const driftClasses: Record<DriftStatus, string> = {
  green: "bg-drift-green text-white",
  yellow: "bg-drift-yellow text-white",
  red: "bg-drift-red text-white"
};

const driftColor: Record<DriftStatus, string> = {
  green: "#10B981",
  yellow: "#EAB308",
  red: "#EF4444"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 ${statusClasses[status]}`}>
      <span className="text-xs font-medium">{statusLabels[status]}</span>
    </span>
  );
}

export function DriftBadge({ severity }: DriftBadgeProps) {
  if (!severity) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#D1D5DB] px-3 py-1.5 text-xs font-medium text-[#374151]">
        Unknown
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 ${driftClasses[severity]}`}>
      <span className="text-xs font-medium">{driftLabels[severity]}</span>
    </span>
  );
}

export function DriftIndicator({ severity, showLabel = false }: DriftIndicatorProps) {
  if (!severity) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-[#9CA3AF]" />
        {showLabel ? <span className="text-sm text-[#6B7280]">Unknown</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: driftColor[severity] }} />
      {showLabel ? (
        <span className="text-sm" style={{ color: driftColor[severity] }}>
          {driftLabels[severity]}
        </span>
      ) : null}
    </div>
  );
}

export function YesNoBadge({ value }: YesNoBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-white ${
        value ? "bg-drift-red" : "bg-drift-green"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}
