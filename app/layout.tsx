import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import GlobalNav from "@/components/global-nav";
import { getRuns } from "@/lib/supabase";
import { toUiRun } from "@/lib/ui-mappers";

export const metadata: Metadata = {
  title: "DriftWatch | Synthetic-First Model Drift Monitoring",
  description:
    "Monitor feature drift and prediction drift using a zero-cost, synthetic-first MLOps pipeline.",
  icons: {
    icon: "/favicon.ico"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const latestRunRaw = await getRuns(1)
    .then((runs) => runs[0] ?? null)
    .catch(() => null);
  const latestRun = latestRunRaw ? toUiRun(latestRunRaw) : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme by applying saved preference synchronously */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dw_theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-[#111827] dark:text-white">
        <GlobalNav latestRun={latestRun} />
        <main className="mx-auto w-full max-w-[1280px] p-6">{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
