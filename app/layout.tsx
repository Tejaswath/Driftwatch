import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import GlobalNav from "@/components/global-nav";
import { getRuns } from "@/lib/supabase";
import { toUiRun } from "@/lib/ui-mappers";

export const metadata: Metadata = {
  title: "DriftWatch",
  description: "Nordea-first drift monitoring MVP"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const latestRunRaw = await getRuns(1)
    .then((runs) => runs[0] ?? null)
    .catch(() => null);
  const latestRun = latestRunRaw ? toUiRun(latestRunRaw) : null;

  return (
    <html lang="en">
      <body>
        <GlobalNav latestRun={latestRun} />
        <main className="mx-auto w-full max-w-[1280px] p-6">{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
