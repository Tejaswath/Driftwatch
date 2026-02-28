import RunsClientTable from "@/components/runs-client-table";
import { getRuns } from "@/lib/supabase";
import { toUiRuns } from "@/lib/ui-mappers";

export default async function RunsPage() {
  const runs = toUiRuns(await getRuns(100).catch(() => []));

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-nordea-navy">Run History</h1>
        <RunsClientTable runs={runs} />
      </div>
    </div>
  );
}
