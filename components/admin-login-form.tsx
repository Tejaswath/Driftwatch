"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Login failed");
      setLoading(false);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    toast.success("Successfully authenticated");
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className={`w-full max-w-md rounded-lg border border-[#E5E5E5] bg-white p-8 ${isShaking ? "animate-[shake_0.5s]" : ""}`}>
      <div className="mb-6 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-nordea-navy/10">
          <Lock size={32} className="text-nordea-navy" />
        </div>
        <h1 className="text-xl font-bold text-nordea-navy">Admin Access</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm text-[#6B7280]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="Enter admin password"
              className="h-10 w-full rounded-lg border border-[#E5E5E5] px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-nordea-teal"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-nordea-navy"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error ? <p className="text-center text-sm text-[#EF4444]">{error}</p> : null}

        <button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full rounded-lg bg-nordea-teal text-sm font-medium text-white transition-colors hover:bg-[#008A83] disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
