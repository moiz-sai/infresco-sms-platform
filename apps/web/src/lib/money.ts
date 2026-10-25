// Rupee text typed by the user → integer paisa (SPEC §3: money is never a float in storage).
export function rupeesToPaisa(input: string): number | null {
  const clean = input.replace(/[,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const [whole, frac = ''] = clean.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

export function paisaToRupees(paisa: number): string {
  return paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2)
}
