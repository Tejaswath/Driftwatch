import { redirect } from "next/navigation";
import AdminActions from "@/components/admin-actions";
import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  const isAdmin = requireAdminSession();
  if (!isAdmin) {
    redirect("/admin/login");
  }

  return (
    <section className="stack">
      <h1>Admin Actions</h1>
      <p>
        These actions dispatch GitHub workflows only. Drift compute and privileged writes happen in GitHub
        Actions.
      </p>
      <AdminActions />
    </section>
  );
}
