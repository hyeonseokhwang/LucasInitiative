/**
 * Reusable skeleton loader for consistent loading states across panels.
 */

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-700/40 rounded ${className}`} />
  )
}

/** Card-style skeleton (summary cards row) */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <Shimmer className="h-2.5 w-16 mb-2" />
          <Shimmer className="h-6 w-12" />
        </div>
      ))}
    </div>
  )
}

/** Chart-style skeleton */
export function SkeletonChart({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`bg-slate-900/40 rounded-lg p-4 border border-slate-700/30 ${height} flex items-end gap-1.5`}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Shimmer
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${20 + Math.random() * 60}%` } as any}
        />
      ))}
    </div>
  )
}

/** Table-style skeleton */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30">
        <Shimmer className="h-3 w-24" />
      </div>
      <div className="divide-y divide-slate-700/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Shimmer className="h-3 w-32" />
            <Shimmer className="h-3 w-16 ml-auto" />
            <Shimmer className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Generic panel skeleton: cards + chart + table */
export function SkeletonPanel() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <SkeletonCards />
      <SkeletonChart />
      <SkeletonTable />
    </div>
  )
}
