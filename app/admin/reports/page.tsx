import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";
import { markReportReviewed, markReportResolved } from "./actions";

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, status, created_at, reporter_id")
    .order("created_at", { ascending: false })
    .limit(50);

  const open = (reports ?? []).filter((r) => r.status === "open");
  const other = (reports ?? []).filter((r) => r.status !== "open");

  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>
          Reports
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {open.length} open report{open.length === 1 ? "" : "s"}
        </p>

        {open.length === 0 && (
          <div className="rounded-xl border p-8 text-center text-sm text-gray-500 mb-8" style={{ borderColor: "var(--sand)" }}>
            No open reports.
          </div>
        )}

        <div className="space-y-3 mb-8">
          {open.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--clay)" }}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[10px] font-semibold uppercase rounded-full px-2 py-0.5"
                  style={{ background: "var(--sand)", color: "var(--ink)" }}
                >
                  {r.target_type}
                </span>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm mb-3">{r.reason}</p>
              <div className="flex gap-2">
                <form action={markReportReviewed.bind(null, r.id)}>
                  <button type="submit" className="rounded-full px-3 py-1.5 text-xs font-medium border" style={{ borderColor: "var(--sand)" }}>
                    Mark reviewed
                  </button>
                </form>
                <form action={markReportResolved.bind(null, r.id)}>
                  <button type="submit" className="rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ background: "var(--leaf)" }}>
                    Resolve
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        {other.length > 0 && (
          <>
            <h2 className="text-sm font-semibold mb-3">Closed</h2>
            <div className="space-y-1.5">
              {other.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b" style={{ borderColor: "var(--sand)" }}>
                  <span className="truncate max-w-xs">{r.reason}</span>
                  <span className="text-xs text-gray-400">{r.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
