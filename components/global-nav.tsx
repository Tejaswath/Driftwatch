"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { UiRun } from "@/lib/types";

type GlobalNavProps = {
  latestRun: UiRun | null;
};

function isRouteActive(pathname: string, target: string): boolean {
  if (target === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(target);
}

export default function GlobalNav({ latestRun }: GlobalNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/admin/login") {
    return null;
  }

  const sourceMode = latestRun?.sourceMode ?? "Mock";
  const isHealthy = Boolean(latestRun && (latestRun.status === "completed" || latestRun.status === "processing"));

  return (
    <>
      <div className="h-14 bg-nordea-navy px-6">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-white">
            DriftWatch
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <div className="rounded-full border border-white px-3 py-1">
              <span className="text-xs font-medium text-white">Sandbox</span>
            </div>

            <div className={`rounded-full px-3 py-1 ${sourceMode === "Live" ? "bg-nordea-teal" : "bg-[#9CA3AF]"}`}>
              <span className="text-xs font-medium text-white">{sourceMode}</span>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white px-3 py-1">
              <div className={`h-2 w-2 rounded-full ${isHealthy ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
              <span className="text-xs font-medium text-white">{isHealthy ? "Healthy" : "Stale"}</span>
            </div>

            <Link href="/admin" className="text-sm text-white hover:underline">
              Admin
            </Link>
          </div>

          <button
            type="button"
            className="text-white md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div className="h-12 border-b border-[#E5E5E5] bg-white">
        <div className="mx-auto hidden h-full w-full max-w-[1280px] items-center gap-8 px-6 md:flex">
          {[
            { href: "/", label: "Dashboard" },
            { href: "/runs", label: "Runs" },
            { href: "/admin", label: "Admin" }
          ].map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex h-full items-center text-sm ${
                  active ? "text-nordea-navy" : "text-[#6B7280] hover:text-nordea-navy"
                }`}
              >
                {item.label}
                {active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-nordea-teal" /> : null}
              </Link>
            );
          })}
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-b border-[#E5E5E5] bg-white p-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-sm text-[#6B7280] hover:text-nordea-navy" onClick={() => setMobileMenuOpen(false)}>
              Dashboard
            </Link>
            <Link
              href="/runs"
              className="text-sm text-[#6B7280] hover:text-nordea-navy"
              onClick={() => setMobileMenuOpen(false)}
            >
              Runs
            </Link>
            <Link
              href="/admin"
              className="text-sm text-[#6B7280] hover:text-nordea-navy"
              onClick={() => setMobileMenuOpen(false)}
            >
              Admin
            </Link>

            <div className="flex flex-wrap gap-2 border-t border-[#E5E5E5] pt-4">
              <div className="rounded-full border border-nordea-navy px-3 py-1">
                <span className="text-xs font-medium text-nordea-navy">Sandbox</span>
              </div>
              <div className={`rounded-full px-3 py-1 ${sourceMode === "Live" ? "bg-nordea-teal" : "bg-[#9CA3AF]"}`}>
                <span className="text-xs font-medium text-white">{sourceMode}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#D1D5DB] px-3 py-1">
                <div className={`h-2 w-2 rounded-full ${isHealthy ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                <span className="text-xs font-medium text-[#6B7280]">{isHealthy ? "Healthy" : "Stale"}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
