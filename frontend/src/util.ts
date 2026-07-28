/** Reparte num_pages en n rangos contiguos parejos (espejo del backend). */
export function evenRanges(numPages: number, n: number): string[] {
  n = Math.max(1, Math.min(n, numPages))
  const base = Math.floor(numPages / n)
  const rem = numPages % n
  const out: string[] = []
  let start = 1
  for (let i = 0; i < n; i++) {
    const count = base + (i < rem ? 1 : 0)
    const end = start + count - 1
    out.push(`${start}-${end}`)
    start = end + 1
  }
  return out
}

export const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback
