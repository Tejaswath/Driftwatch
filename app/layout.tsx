import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DriftWatch",
  description: "Nordea-first drift monitoring MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <nav>
            <Link href="/">Dashboard</Link>
            <Link href="/runs">Runs</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
