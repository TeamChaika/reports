import { iikoPost, type IikoConfig } from './client'
import { db } from '../lib/supabase'

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0] as string
}

type OlapResponse<T> = T[] | { data?: T[] }

function rows<T>(res: OlapResponse<T>): T[] {
  return Array.isArray(res) ? res : (res.data ?? [])
}

interface PayTypeRow {
  Department: string
  'OpenDate.Typed': string
  PayTypes: string
  DishAmountInt: number
  DishSumInt: number
  DishDiscountSumInt: number
}

interface HourRow {
  Department: string
  'OpenDate.Typed': string
  HourOpen: string
  DishDiscountSumInt: number
  'UniqOrderId.OrdersCount': number
  GuestNum: number
}

// Syncs OLAP sales data into iiko_olap_cache (by pay type) and iiko_hourly_cache (by hour).
// Window: last 35 days through tomorrow so the current open shift is included.
export async function syncIikoSales(config: IikoConfig): Promise<{ payTypes: number; hourly: number }> {
  const from = dateStr(new Date(Date.now() - 35 * 86_400_000))
  const to = dateStr(new Date(Date.now() + 86_400_000))

  // department name → id
  const { data: depts } = await db
    .from('iiko_departments')
    .select('id, name')
    .eq('type', 'DEPARTMENT')
  const deptByName = new Map((depts ?? []).map(d => [d.name as string, d.id as string]))

  const now = new Date().toISOString()

  // ── Query A: revenue by pay type ──────────────────────────────────────────
  const payRes = await iikoPost<OlapResponse<PayTypeRow>>(config, '/resto/api/v2/reports/olap', {
    reportType: 'SALES',
    buildSummary: 'false',
    groupByRowFields: ['OpenDate.Typed', 'Department', 'PayTypes'],
    aggregateFields: ['DishAmountInt', 'DishSumInt', 'DishDiscountSumInt'],
    filters: { 'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to } },
  })
  const payRows = rows(payRes)

  const payRecords = payRows.map(r => ({
    department_id: deptByName.get(r.Department) ?? null,
    department_name: r.Department,
    business_date: r['OpenDate.Typed'],
    pay_type: r.PayTypes,
    dish_amount: Number(r.DishAmountInt ?? 0),
    dish_sum: Number(r.DishSumInt ?? 0),
    dish_discount_sum: Number(r.DishDiscountSumInt ?? 0),
    fetched_at: now,
  }))

  if (payRecords.length > 0) {
    const { error } = await db
      .from('iiko_olap_cache')
      .upsert(payRecords, { onConflict: 'department_name,business_date,pay_type' })
    if (error) throw new Error(`sync pay types: ${error.message}`)
  }

  // ── Query B: hourly revenue + orders + guests ─────────────────────────────
  const hourRes = await iikoPost<OlapResponse<HourRow>>(config, '/resto/api/v2/reports/olap', {
    reportType: 'SALES',
    buildSummary: 'false',
    groupByRowFields: ['OpenDate.Typed', 'Department', 'HourOpen'],
    aggregateFields: ['DishDiscountSumInt', 'UniqOrderId.OrdersCount', 'GuestNum'],
    filters: { 'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to } },
  })
  const hourRows = rows(hourRes)

  const hourRecords = hourRows
    .map(r => ({
      department_id: deptByName.get(r.Department) ?? null,
      department_name: r.Department,
      business_date: r['OpenDate.Typed'],
      hour: parseInt(r.HourOpen, 10) || 0,
      revenue: Number(r.DishDiscountSumInt ?? 0),
      orders: Math.round(Number(r['UniqOrderId.OrdersCount'] ?? 0)),
      guests: Number(r.GuestNum ?? 0),
      fetched_at: now,
    }))
    .filter(r => r.department_name)

  if (hourRecords.length > 0) {
    const { error } = await db
      .from('iiko_hourly_cache')
      .upsert(hourRecords, { onConflict: 'department_name,business_date,hour' })
    if (error) throw new Error(`sync hourly: ${error.message}`)
  }

  return { payTypes: payRecords.length, hourly: hourRecords.length }
}
