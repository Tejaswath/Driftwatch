import RunTable from "@/components/run-table";
import { getRuns } from "@/lib/supabase";

export default async function RunsPage() {
  const runs = await getRuns(50).catch(() => []);

  return (
    <section className="stack">
      <h1>Run History</h1>
      <RunTable runs={runs} />
    </section>
  );
}
