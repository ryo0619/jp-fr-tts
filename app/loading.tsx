export default function Loading() {
  return (
    <main className="mx-auto max-w-[720px] px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-[720px] px-4 py-3">
          <div className="h-5 w-40 animate-pulse rounded bg-neutral-200" />
        </div>
      </header>

      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-3 w-28 animate-pulse rounded bg-neutral-200" />
              <div className="h-6 w-12 animate-pulse rounded bg-neutral-200" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
            </div>
            <div className="mt-3 h-10 w-28 animate-pulse rounded-full bg-neutral-200" />
          </div>
        ))}
      </div>
    </main>
  );
}
