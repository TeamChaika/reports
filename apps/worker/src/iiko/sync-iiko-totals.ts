import { db } from '../lib/supabase'

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0] as string
}

export async function syncIikoTotals(fromDate?: string, toDate?: string): Promise<number> {
  const to = toDate ?? dateStr(new Date())
  const from = fromDate ?? dateStr(new Date(Date.now() - 7 * 86_400_000))

  // Pull cached OLAP rows for the period, skip rows with no resolved department
  const { data: olapRows, error: olapError } = await db
    .from('iiko_olap_cache')
    .select('department_id, business_date, dish_sum')
    .not('department_id', 'is', null)
    .gte('business_date', from)
    .lte('business_date', to)

  if (olapError) throw new Error(`fetch iiko_olap_cache: ${olapError.message}`)
  if (!olapRows || olapRows.length === 0) return 0

  // Aggregate dish_sum by (department_id, business_date)
  const totals = new Map<string, number>()
  for (const row of olapRows) {
    const key = `${row.department_id}|${row.business_date}`
    totals.set(key, (totals.get(key) ?? 0) + Number(row.dish_sum))
  }

  // Map iiko_department_id → establishment.id
  const { data: establishments, error: estError } = await db
    .from('establishments')
    .select('id, iiko_department_id')
    .not('iiko_department_id', 'is', null)
    .eq('is_active', true)

  if (estError) throw new Error(`fetch establishments: ${estError.message}`)
  if (!establishments || establishments.length === 0) return 0

  const estByDept = new Map(
    establishments.map(e => [e.iiko_department_id as string, e.id as string]),
  )

  // Build per-report update list
  const now = new Date().toISOString()
  const updates: { establishment_id: string; business_date: string; iiko_total: number }[] = []

  for (const [key, iiko_total] of totals) {
    const sep = key.indexOf('|')
    const department_id = key.slice(0, sep)
    const business_date = key.slice(sep + 1)
    const establishment_id = estByDept.get(department_id)
    if (!establishment_id || !business_date) continue
    updates.push({ establishment_id, business_date, iiko_total })
  }

  if (updates.length === 0) return 0

  // Update daily_reports — iiko_diff is a generated column and recalculates automatically
  let updated = 0
  for (const { establishment_id, business_date, iiko_total } of updates) {
    const { error } = await db
      .from('daily_reports')
      .update({ iiko_total, iiko_synced_at: now })
      .eq('establishment_id', establishment_id)
      .eq('business_date', business_date)

    if (error) {
      console.warn(`  ! iiko_total update ${establishment_id}/${business_date}: ${error.message}`)
    } else {
      updated++
    }
  }

  return updated
}
