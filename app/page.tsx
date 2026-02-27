import Link from "next/link";
import RunTable from "@/components/run-table";
import { getRuns } from "@/lib/supabase";

export default async function DashboardPage() {
  const runs = await getRuns(10).catch(() => []);

  return (
    <section className="stack">
      <h1>DriftWatch Dashboard</h1>
      <p>
        Nordea-first drift monitoring with GitHub Actions compute. Admin actions dispatch workflows only,
        and browser reads are RLS-protected via Supabase anon key.
      </p>
      <RunTable runs={runs} />
      <Link href="/runs">View all runs</Link>
    </section>
  );
}
