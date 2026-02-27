import { notFound } from "next/navigation";
import { getRunById } from "@/lib/supabase";

type RunDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const run = await getRunById(params.id);

  if (!run) {
    notFound();
  }

  return (
    <section className="stack">
      <h1>Run {run.id}</h1>
      <div className="card stack">
        <div>
          <strong>Domain:</strong> {run.domain_key}
        </div>
        <div>
          <strong>Status:</strong> {run.status}
        </div>
        <div>
          <strong>Drift Status:</strong> {run.drift_status ?? "-"}
        </div>
        <div>
          <strong>Created:</strong> {new Date(run.created_at).toLocaleString()}
        </div>
        {run.html_report_uri ? (
          <a href={run.html_report_uri} target="_blank" rel="noreferrer">
            Open HTML report
          </a>
        ) : null}
      </div>

      <article className="card stack">
        <h2>Compact Report JSON</h2>
        <pre className="json">{JSON.stringify(run.report_json ?? {}, null, 2)}</pre>
      </article>

      {run.error_text ? (
        <article className="card stack">
          <h2>Error</h2>
          <pre className="json">{run.error_text}</pre>
        </article>
      ) : null}
    </section>
  );
}
