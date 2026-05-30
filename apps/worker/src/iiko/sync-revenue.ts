import { db } from '../lib/supabase'

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0] as string
}

// Maps iiko pay type name → payment_group.code. Returns null to skip.
function resolveGroupCode(payTypeName: string): string | null {
  const s = payTypeName.toLowerCase()
  if (s.includes('без оплаты')) return null
  if (s.includes('наличн')) return 'cash'
  if (s.includes('карт') || s.includes('безнал')) return 'card'
  if (s.includes('кальян')) return 'hookah'
  if (s.includes('онлайн') || s.includes('сайт') || s.includes('доставк')) return 'online'
  return 'other'
}

export async function syncRevenue(fromDate?: string, toDate?: string): Promise<number> {
  const to = toDate ?? dateStr(new Date())
  const from = fromDate ?? dateStr(new Date(Date.now() - 7 * 86_400_000))

  // Payment groups from DB
  const { data: groups, error: groupsError } = await db
    .from('payment_groups')
    .select('id, name, code, maps_to')
    .eq('is_active', true)
  if (groupsError) throw new Error(`fetch payment_groups: ${groupsError.message}`)
  if (!groups || groups.length === 0) throw new Error('no active payment_groups')

  const groupByCode = new Map(groups.map(g => [g.code as string, g]))

  // Establishments indexed by iiko_department_id
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

  // OLAP rows for the period
  const { data: olapRows, error: olapError } = await db
    .from('iiko_olap_cache')
    .select('department_id, business_date, pay_type, dish_sum')
    .not('department_id', 'is', null)
    .gte('business_date', from)
    .lte('business_date', to)
  if (olapError) throw new Error(`fetch iiko_olap_cache: ${olapError.message}`)
  if (!olapRows || olapRows.length === 0) return 0

  // Aggregate: (establishment_id, business_date) → groupCode → amount
  const byEstDate = new Map<string, Map<string, number>>()
  for (const row of olapRows) {
    const estId = estByDept.get(row.department_id as string)
    if (!estId) continue
    const code = resolveGroupCode(row.pay_type as string)
    if (!code) continue
    const key = `${estId}|${row.business_date}`
    if (!byEstDate.has(key)) byEstDate.set(key, new Map())
    const sums = byEstDate.get(key)!
    sums.set(code, (sums.get(code) ?? 0) + Number(row.dish_sum))
  }
  if (byEstDate.size === 0) return 0

  // Load existing reports for the period
  const estIds = [...new Set([...estByDept.values()])]
  const { data: existingReports, error: repError } = await db
    .from('daily_reports')
    .select('id, establishment_id, business_date, status, source')
    .in('establishment_id', estIds)
    .gte('business_date', from)
    .lte('business_date', to)
  if (repError) throw new Error(`fetch daily_reports: ${repError.message}`)

  const reportByKey = new Map(
    (existingReports ?? []).map(r => [`${r.establishment_id}|${r.business_date}`, r]),
  )

  let synced = 0

  for (const [key, groupSums] of byEstDate) {
    const sep = key.indexOf('|')
    const establishment_id = key.slice(0, sep)
    const business_date = key.slice(sep + 1)

    const existing = reportByKey.get(key)

    // Never touch submitted / reviewed / approved reports
    if (existing && existing.status !== 'draft') continue
    // Never overwrite reports a manager created manually
    if (existing && existing.source !== 'iiko') continue

    // Compute revenue totals from group sums
    let revenue_cash = 0
    let revenue_card = 0
    let revenue_other = 0
    for (const [code, amount] of groupSums) {
      const group = groupByCode.get(code)
      if (!group) continue
      if (group.maps_to === 'cash') revenue_cash += amount
      else if (group.maps_to === 'card') revenue_card += amount
      else revenue_other += amount
    }

    let reportId: string

    if (existing) {
      // Update existing iiko-sourced draft; cash_submitted = revenue_cash when no expenses yet
      const { error } = await db
        .from('daily_reports')
        .update({ revenue_cash, revenue_card, revenue_other, cash_submitted: revenue_cash })
        .eq('id', existing.id)
      if (error) {
        console.warn(`  ! revenue update ${key}: ${error.message}`)
        continue
      }
      reportId = existing.id as string
    } else {
      // Create new draft from iiko; cash_submitted = revenue_cash (no expenses yet)
      const { data: created, error } = await db
        .from('daily_reports')
        .insert({ establishment_id, business_date, status: 'draft', source: 'iiko', revenue_cash, revenue_card, revenue_other, cash_submitted: revenue_cash })
        .select('id')
        .single()
      if (error || !created) {
        console.warn(`  ! revenue insert ${key}: ${error?.message}`)
        continue
      }
      reportId = created.id as string
    }

    // Replace report_items with iiko-derived breakdown
    await db.from('report_items').delete().eq('report_id', reportId)

    const items = []
    for (const [code, amount] of groupSums) {
      if (amount <= 0) continue
      const group = groupByCode.get(code)
      if (!group) continue
      items.push({ report_id: reportId, pay_group: group.name, pay_group_id: group.id, amount })
    }
    if (items.length > 0) {
      const { error } = await db.from('report_items').insert(items)
      if (error) console.warn(`  ! report_items insert ${reportId}: ${error.message}`)
    }

    synced++
  }

  return synced
}
