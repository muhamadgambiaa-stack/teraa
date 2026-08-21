export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="h-24 rounded-xl mb-6 animate-pulse" style={{ background: "var(--sand)" }} />
      <div className="h-8 w-40 rounded mb-4 animate-pulse" style={{ background: "var(--sand)" }} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sand)" }}>
            <div className="aspect-square animate-pulse" style={{ background: "var(--sand)" }} />
            <div className="p-3 space-y-2">
              <div className="h-3 rounded animate-pulse" style={{ background: "var(--sand)" }} />
              <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: "var(--sand)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
