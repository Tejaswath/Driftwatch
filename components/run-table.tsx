import Link from "next/link";
import type { MonitorRun } from "@/lib/types";

type RunTableProps = {
  runs: MonitorRun[];
};

export default function RunTable({ runs }: RunTableProps) {
  if (runs.length === 0) {
    return <p>No runs yet.</p>;
  }

  return (
    <table className="run-table">
      <thead>
        <tr>
          <th>Run ID</th>
          <th>Domain</th>
          <th>Status</th>
          <th>Drift</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>
              <Link href={`/runs/${run.id}`}>{run.id.slice(0, 8)}</Link>
            </td>
            <td>{run.domain_key}</td>
            <td>{run.status}</td>
            <td>{run.drift_status ?? "-"}</td>
            <td>{new Date(run.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
