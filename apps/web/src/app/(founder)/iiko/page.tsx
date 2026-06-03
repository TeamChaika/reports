import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { IikoFilters } from './IikoFilters'
import { HourlyChart } from './HourlyChart'
import { PayGroupBreakdown, type PayGroup } from './PayGroupBreakdown'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Maps an iiko pay-type name to a payment group code.
// Кальяны относятся к безналичным.
function resolveGroupCode(payTypeName: string): string {
  const s = payTypeName.toLowerCase()
  if (s.includes('наличн')) return 'cash'
  if (s.includes('карт') || s.includes('безнал') || s.includes('кальян')) return 'card'
  if (s.includes('онлайн') || s.includes('сайт') || s.includes('доставк')) return 'online'
  return 'other'
}

export default async function IikoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; est?: string }>
}) {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') redirect('/dashboard')

  const { from: rawFrom, to: rawTo, est = '' } = await searchParams
  const today = todayStr()
  const from = rawFrom ?? today
  const to = rawTo ?? today
  const isSingleDay = from === to

  const supabase = await createClient()

  const { data: establishments } = await supabase
    .from('establishments')
    .select('id, name, iiko_department_id')
    .eq('is_active', true)
    .order('name')

  const selectedEst = (establishments ?? []).find(e => e.id === est)
  const deptFilter = selectedEst?.iiko_department_id ?? null

  // ── Pay-type cache ────────────────────────────────────────────────────────
  let payQuery = supabase
    .from('iiko_olap_cache')
    .select('department_name, pay_type, dish_discount_sum')
    .gte('business_date', from)
    .lte('business_date', to)
  if (deptFilter) payQuery = payQuery.eq('department_id', deptFilter)
  const { data: payRows } = await payQuery

  // ── Hourly cache ──────────────────────────────────────────────────────────
  let hourQuery = supabase
    .from('iiko_hourly_cache')
    .select('department_name, hour, revenue, orders, guests')
    .gte('business_date', from)
    .lte('business_date', to)
  if (deptFilter) hourQuery = hourQuery.eq('department_id', deptFilter)
  const { data: hourRows } = await hourQuery

  // ── Financial summary cache (markup / discount / cost) ────────────────────
  let sumQuery = supabase
    .from('iiko_summary_cache')
    .select('department_name, gross, net, discount, profit, cost, markup, discount_pct')
    .gte('business_date', from)
    .lte('business_date', to)
  if (deptFilter) sumQuery = sumQuery.eq('department_id', deptFilter)
  const { data: sumRows } = await sumQuery

  // ── Discount-by-type cache ────────────────────────────────────────────────
  let discQuery = supabase
    .from('iiko_discount_cache')
    .select('discount_type, amount')
    .gte('business_date', from)
    .lte('business_date', to)
  if (deptFilter) discQuery = discQuery.eq('department_id', deptFilter)
  const { data: discRows } = await discQuery

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totalRevenue = (payRows ?? []).reduce((s, r) => s + Number(r.dish_discount_sum), 0)
  const totalOrders = (hourRows ?? []).reduce((s, r) => s + Number(r.orders), 0)
  const totalGuests = (hourRows ?? []).reduce((s, r) => s + Number(r.guests), 0)
  const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // By pay type → grouped into payment groups
  const { data: paymentGroups } = await supabase
    .from('payment_groups')
    .select('code, name, sort_order')
    .order('sort_order')
  const groupName = new Map((paymentGroups ?? []).map(g => [g.code as string, g.name as string]))

  const payMap = new Map<string, number>()
  for (const r of payRows ?? []) {
    payMap.set(r.pay_type, (payMap.get(r.pay_type) ?? 0) + Number(r.dish_discount_sum))
  }

  const groupAgg = new Map<string, { total: number; types: Map<string, number> }>()
  for (const [type, total] of payMap) {
    if (total <= 0) continue
    const code = resolveGroupCode(type)
    const g = groupAgg.get(code) ?? { total: 0, types: new Map<string, number>() }
    g.total += total
    g.types.set(type, (g.types.get(type) ?? 0) + total)
    groupAgg.set(code, g)
  }
  const payGroupBreakdown: PayGroup[] = [...groupAgg.entries()]
    .map(([code, g]) => ({
      code,
      name: groupName.get(code) ?? code,
      total: g.total,
      types: [...g.types.entries()]
        .map(([name, t]) => ({ name, total: t }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total)

  // By establishment
  const estMap = new Map<string, { revenue: number; orders: number }>()
  for (const r of payRows ?? []) {
    const e = estMap.get(r.department_name) ?? { revenue: 0, orders: 0 }
    e.revenue += Number(r.dish_discount_sum)
    estMap.set(r.department_name, e)
  }
  for (const r of hourRows ?? []) {
    const e = estMap.get(r.department_name) ?? { revenue: 0, orders: 0 }
    e.orders += Number(r.orders)
    estMap.set(r.department_name, e)
  }
  // Per-establishment markup from iiko native MarkUp, cost-weighted across the period
  const estFin = new Map<string, { markupCost: number; cost: number }>()
  for (const r of sumRows ?? []) {
    const f = estFin.get(r.department_name) ?? { markupCost: 0, cost: 0 }
    f.markupCost += Number(r.markup) * Number(r.cost)
    f.cost += Number(r.cost)
    estFin.set(r.department_name, f)
  }
  const estBreakdown = [...estMap.entries()]
    .map(([name, v]) => {
      const f = estFin.get(name)
      // native MarkUp is a fraction (2.086 = 208.6%); ×100 for display
      const markup = f && f.cost > 0 ? (f.markupCost / f.cost) * 100 : null
      return { name, revenue: v.revenue, orders: v.orders, avg: v.orders > 0 ? v.revenue / v.orders : 0, markup }
    })
    .filter(e => e.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // Hourly (summed across selected establishments)
  const hourMap = new Map<number, { revenue: number; orders: number }>()
  for (const r of hourRows ?? []) {
    const e = hourMap.get(r.hour) ?? { revenue: 0, orders: 0 }
    e.revenue += Number(r.revenue)
    e.orders += Number(r.orders)
    hourMap.set(r.hour, e)
  }
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    revenue: hourMap.get(h)?.revenue ?? 0,
    orders: hourMap.get(h)?.orders ?? 0,
  }))

  const maxPay = Math.max(...payGroupBreakdown.map(p => p.total), 1)

  // Financials: native iiko MarkUp (cost-weighted) and DiscountPercent (gross-weighted)
  const fin = (sumRows ?? []).reduce(
    (a, r) => ({
      gross: a.gross + Number(r.gross),
      net: a.net + Number(r.net),
      discount: a.discount + Number(r.discount),
      profit: a.profit + Number(r.profit),
      cost: a.cost + Number(r.cost),
      markupCost: a.markupCost + Number(r.markup) * Number(r.cost),
      discountGross: a.discountGross + Number(r.discount_pct) * Number(r.gross),
    }),
    { gross: 0, net: 0, discount: 0, profit: 0, cost: 0, markupCost: 0, discountGross: 0 },
  )
  const markupPct = fin.cost > 0 ? (fin.markupCost / fin.cost) * 100 : 0
  const discountPct = fin.gross > 0 ? (fin.discountGross / fin.gross) * 100 : 0

  // Discount by type (skip rows without a discount type)
  const discMap = new Map<string, number>()
  for (const r of discRows ?? []) {
    const t = (r.discount_type ?? '').trim()
    if (!t) continue
    discMap.set(t, (discMap.get(t) ?? 0) + Number(r.amount))
  }
  const discountBreakdown = [...discMap.entries()]
    .map(([type, amount]) => ({ type, amount }))
    .filter(d => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const totalDiscount = discountBreakdown.reduce((s, d) => s + d.amount, 0)
  const maxDisc = Math.max(...discountBreakdown.map(d => d.amount), 1)

  const dateLabel = isSingleDay
    ? new Date(from + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
    : `${from} — ${to}`

  const kpis = [
    { label: 'Выручка iiko', value: Math.round(totalRevenue).toLocaleString('ru') + ' ₽', color: 'var(--color-text)' },
    { label: 'Чеков', value: totalOrders.toLocaleString('ru'), color: 'var(--color-text)' },
    { label: 'Средний чек', value: Math.round(avgCheck).toLocaleString('ru') + ' ₽', color: 'var(--color-accent)' },
    { label: 'Гостей', value: Math.round(totalGuests).toLocaleString('ru'), color: 'var(--color-text)' },
  ]

  const hasData = totalRevenue > 0 || totalOrders > 0

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              iiko · Выручка
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {dateLabel}{selectedEst ? ` · ${selectedEst.name}` : ''}
            </p>
          </div>
          <IikoFilters from={from} to={to} est={est} establishments={establishments ?? []} />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, color }) => (
            <div
              key={label}
              className="px-5 py-4 rounded-xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Financial metrics row */}
        {hasData && fin.gross > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Наценка', value: markupPct.toFixed(0) + '%', sub: Math.round(fin.profit).toLocaleString('ru') + ' ₽', color: 'var(--color-success)' },
              { label: 'Скидка', value: discountPct.toFixed(1) + '%', sub: Math.round(fin.discount).toLocaleString('ru') + ' ₽', color: 'var(--color-warning)' },
              { label: 'Себестоимость', value: Math.round(fin.cost).toLocaleString('ru') + ' ₽', sub: null, color: 'var(--color-text)' },
              { label: 'Выручка без скидки', value: Math.round(fin.gross).toLocaleString('ru') + ' ₽', sub: null, color: 'var(--color-text-muted)' },
            ].map(({ label, value, sub, color }) => (
              <div
                key={label}
                className="px-5 py-4 rounded-xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                {sub && <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--color-text-disabled)' }}>{sub}</p>}
              </div>
            ))}
          </div>
        )}

        {!hasData ? (
          <div
            className="p-10 text-center rounded-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Нет данных iiko за выбранный период
            </p>
          </div>
        ) : (
          <>
            {/* Hourly dynamics */}
            <HourlyChart data={hourly} />

            <div className="grid md:grid-cols-2 gap-6">
              {/* Pay type breakdown */}
              <div
                className="rounded-xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
              >
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                  По группам оплат
                </h2>
                <PayGroupBreakdown groups={payGroupBreakdown} max={maxPay} />
              </div>

              {/* By establishment */}
              <div
                className="rounded-xl overflow-x-auto"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
              >
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                  По заведениям
                </h2>
                <table className="data-table" style={{ minWidth: '380px' }}>
                  <thead>
                    <tr>
                      <th>Заведение</th>
                      <th style={{ textAlign: 'right' }}>Выручка</th>
                      <th style={{ textAlign: 'right' }}>Чеков</th>
                      <th style={{ textAlign: 'right' }}>Ср. чек</th>
                      <th style={{ textAlign: 'right' }}>Наценка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estBreakdown.map(e => (
                      <tr key={e.name}>
                        <td style={{ color: 'var(--color-text)' }}>{e.name}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
                          {Math.round(e.revenue).toLocaleString('ru')} ₽
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                          {e.orders}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                          {Math.round(e.avg).toLocaleString('ru')} ₽
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', color: e.markup != null ? 'var(--color-success)' : 'var(--color-text-disabled)' }}>
                          {e.markup != null ? e.markup.toFixed(0) + '%' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discounts by type */}
            {discountBreakdown.length > 0 && (
              <div
                className="rounded-xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Скидки по типам
                  </h2>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-warning)' }}>
                    {Math.round(totalDiscount).toLocaleString('ru')} ₽
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {discountBreakdown.map(d => (
                    <div key={d.type}>
                      <div className="flex items-center justify-between mb-1 gap-3">
                        <span className="text-sm truncate-1" style={{ color: 'var(--color-text)' }}>{d.type}</span>
                        <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: 'var(--color-text)' }}>
                          {Math.round(d.amount).toLocaleString('ru')} ₽
                          <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-disabled)' }}>
                            {((d.amount / totalDiscount) * 100).toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <div style={{ height: '5px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg)' }}>
                        <div
                          style={{
                            width: `${(d.amount / maxDisc) * 100}%`,
                            height: '100%',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-warning)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
