import AdminLoginForm from "@/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <section className="stack">
      <h1>Admin Login</h1>
      <p>Use the server-side admin password to dispatch workflows.</p>
      <AdminLoginForm />
    </section>
  );
}
