import { redirect } from "next/navigation";
import AdminActions from "@/components/admin-actions";
import { requireAdminSession } from "@/lib/admin-auth";
import { getRuns } from "@/lib/supabase";
import { toUiRuns } from "@/lib/ui-mappers";

export default async function AdminPage() {
  const isAdmin = requireAdminSession();
  if (!isAdmin) {
    redirect("/admin/login");
  }

  const recentRuns = toUiRuns(await getRuns(10).catch(() => []));

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-nordea-navy">Admin Panel</h1>
        <p className="text-sm text-[#6B7280]">
          These actions dispatch GitHub workflows only. Drift compute and privileged writes happen in GitHub
          Actions.
        </p>
        <AdminActions initialRuns={recentRuns} />
      </div>
    </div>
  );
}
