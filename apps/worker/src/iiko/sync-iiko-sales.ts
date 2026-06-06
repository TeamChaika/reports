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

interface SummaryRow {
  Department: string
  'OpenDate.Typed': string
  DishSumInt: number
  DishDiscountSumInt: number
  DiscountSum: number
  'ProductCostBase.Profit': number
  'ProductCostBase.ProductCost': number
  'ProductCostBase.MarkUp': number
  DiscountPercent: number
}

interface DiscountRow {
  Department: string
  'OpenDate.Typed': string
  'OrderDiscount.Type': string
  DiscountSum: number
}

// Syncs OLAP sales data into iiko_olap_cache (by pay type) and iiko_hourly_cache (by hour).
// Default window: last 35 days through tomorrow so the current open shift is included.
// Pass fromOverride/toOverride for historical backfill.
//
// All iiko calls go through iikoPost, which reuses the shared cached session
// (see ./session) — no per-request auth, so the concurrent-session pool stays
// healthy.
export async function syncIikoSales(
  config: IikoConfig,
  fromOverride?: string,
  toOverride?: string,
): Promise<{ payTypes: number; hourly: number; summary: number; discounts: number }> {
  const from = fromOverride ?? dateStr(new Date(Date.now() - 35 * 86_400_000))
  const to = toOverride ?? dateStr(new Date(Date.now() + 86_400_000))

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

  // ── Query C: financial summary (markup, cost, discount) by establishment ──
  const sumRes = await iikoPost<OlapResponse<SummaryRow>>(config, '/resto/api/v2/reports/olap', {
    reportType: 'SALES',
    buildSummary: 'false',
    groupByRowFields: ['OpenDate.Typed', 'Department'],
    aggregateFields: ['DishSumInt', 'DishDiscountSumInt', 'DiscountSum', 'ProductCostBase.Profit', 'ProductCostBase.ProductCost', 'ProductCostBase.MarkUp', 'DiscountPercent'],
    filters: { 'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to } },
  })
  const sumRecords = rows(sumRes)
    .map(r => ({
      department_id: deptByName.get(r.Department) ?? null,
      department_name: r.Department,
      business_date: r['OpenDate.Typed'],
      gross: Number(r.DishSumInt ?? 0),
      net: Number(r.DishDiscountSumInt ?? 0),
      discount: Number(r.DiscountSum ?? 0),
      profit: Number(r['ProductCostBase.Profit'] ?? 0),
      cost: Number(r['ProductCostBase.ProductCost'] ?? 0),
      markup: Number(r['ProductCostBase.MarkUp'] ?? 0),
      discount_pct: Number(r.DiscountPercent ?? 0),
      fetched_at: now,
    }))
    .filter(r => r.department_name)

  if (sumRecords.length > 0) {
    const { error } = await db
      .from('iiko_summary_cache')
      .upsert(sumRecords, { onConflict: 'department_name,business_date' })
    if (error) throw new Error(`sync summary: ${error.message}`)
  }

  // ── Query D: discount amounts by type ─────────────────────────────────────
  const discRes = await iikoPost<OlapResponse<DiscountRow>>(config, '/resto/api/v2/reports/olap', {
    reportType: 'SALES',
    buildSummary: 'false',
    groupByRowFields: ['OpenDate.Typed', 'Department', 'OrderDiscount.Type'],
    aggregateFields: ['DiscountSum'],
    filters: { 'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to } },
  })
  const discRecords = rows(discRes)
    .map(r => ({
      department_id: deptByName.get(r.Department) ?? null,
      department_name: r.Department,
      business_date: r['OpenDate.Typed'],
      discount_type: (r['OrderDiscount.Type'] ?? '').trim(),
      amount: Number(r.DiscountSum ?? 0),
      fetched_at: now,
    }))
    .filter(r => r.department_name && r.amount > 0)

  if (discRecords.length > 0) {
    const { error } = await db
      .from('iiko_discount_cache')
      .upsert(discRecords, { onConflict: 'department_name,business_date,discount_type' })
    if (error) throw new Error(`sync discounts: ${error.message}`)
  }

  return { payTypes: payRecords.length, hourly: hourRecords.length, summary: sumRecords.length, discounts: discRecords.length }
}
