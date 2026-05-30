import { iikoPost, type IikoConfig } from './client'
import { db } from '../lib/supabase'

interface OlapRow {
  Department: string
  'OpenDate.Typed': string
  PayTypes: string
  DishAmountInt: number
  DishSumInt: number
  DishDiscountSumInt: number
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0] as string
}

export async function syncOlap(
  config: IikoConfig,
  fromDate?: string,
  toDate?: string,
): Promise<number> {
  const from = fromDate ?? dateStr(new Date(Date.now() - 7 * 86_400_000))
  // iiko OLAP requires to > from, so always request one day ahead to include today's open shift
  const to = toDate ?? dateStr(new Date(Date.now() + 86_400_000))

  const response = await iikoPost<OlapRow[] | { data: OlapRow[] }>(
    config,
    '/resto/api/v2/reports/olap',
    {
      reportType: 'SALES',
      buildSummary: 'false',
      groupByRowFields: ['OpenDate.Typed', 'Department'],
      groupByColFields: ['PayTypes'],
      aggregateFields: ['DishAmountInt', 'DishSumInt', 'DishDiscountSumInt'],
      filters: {
        'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to },
      },
    },
  )

  // iiko returns { data: [...], summary: [] } or a plain array
  const rows = Array.isArray(response)
    ? response
    : ((response as { data?: OlapRow[] }).data ?? [])
  if (rows.length === 0) return 0

  // Resolve department names → ids
  const { data: depts } = await db
    .from('iiko_departments')
    .select('id, name')
    .eq('type', 'DEPARTMENT')
  const deptByName = new Map(depts?.map(d => [d.name as string, d.id as string]) ?? [])

  // Upsert pay type names discovered from this OLAP run
  const payTypeNames = [...new Set(rows.map(r => r.PayTypes).filter(Boolean))]
  if (payTypeNames.length > 0) {
    await db
      .from('iiko_pay_types')
      .upsert(payTypeNames.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
  }

  const now = new Date().toISOString()
  const records = rows.map(r => ({
    department_id: deptByName.get(r.Department) ?? null,
    department_name: r.Department,
    business_date: r['OpenDate.Typed'],
    pay_type: r.PayTypes,
    dish_amount: r.DishAmountInt ?? 0,
    dish_sum: r.DishSumInt ?? 0,
    dish_discount_sum: r.DishDiscountSumInt ?? 0,
    fetched_at: now,
  }))

  const { error } = await db
    .from('iiko_olap_cache')
    .upsert(records, { onConflict: 'department_name,business_date,pay_type' })
  if (error) throw new Error(`sync olap failed: ${error.message}`)
  return records.length
}
