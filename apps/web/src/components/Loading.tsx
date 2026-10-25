import { Skeleton } from '@/components/ui/skeleton'

// Placeholder rows while a list or form loads (SPEC §T9 loading skeletons).
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
