import Link from "next/link";
import { ArrowRight, Beaker, LineChart, ShieldCheck } from "lucide-react";

type LandingHeroProps = {
  hasRuns: boolean;
};

const cards = [
  {
    title: "Synthetic Scenarios",
    text: "Generate stable, inflation, subscription spike, and income-drop batches for repeatable drift experiments.",
    icon: Beaker
  },
  {
    title: "Feature + Prediction Drift",
    text: "Track feature distribution drift and model output drift in one run for stronger model-risk visibility.",
    icon: LineChart
  },
  {
    title: "Zero-Cost Stack",
    text: "Vercel + Supabase + GitHub Actions. No always-on workers, no paid queue, no hidden runtime costs.",
    icon: ShieldCheck
  }
];

export default function LandingHero({ hasRuns }: LandingHeroProps) {
  if (hasRuns) {
    return null;
  }

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[#E5E5E5] bg-gradient-to-r from-[#0B0BA8] via-[#0A25B8] to-[#0E2A90] p-6 text-white md:p-8">
      <div className="mb-6 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">DriftWatch</p>
        <h1 className="text-3xl font-bold md:text-4xl">Synthetic-First Drift Monitoring</h1>
        <p className="max-w-3xl text-sm text-white/85 md:text-base">
          Build scenario batches, refresh baseline models, run drift monitoring, and investigate alerts with full
          lineage and auditability.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-[1px]">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Icon size={18} />
              </div>
              <h2 className="mb-2 text-sm font-semibold md:text-base">{card.title}</h2>
              <p className="text-xs text-white/85 md:text-sm">{card.text}</p>
            </div>
          );
        })}
      </div>

      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0B0BA8] transition-colors hover:bg-[#F4F4F4]"
      >
        Open Admin Panel
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
