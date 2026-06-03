import { iikoFetch, type IikoConfig } from './client'
import { db } from '../lib/supabase'

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0] as string
}

interface CashShift {
  id: string
  openDate: string
  closeDate: string | null
  sessionStatus: string // OPEN | CLOSED | ACCEPTED | UNACCEPTED | HASWARNINGS
  payOrders: number
}

// Syncs iiko cash-shift status + revenue into daily_reports.
// Processes a rolling window of recent days (not just today): a shift for a
// business day is usually closed after midnight, so past reports must keep
// being refreshed until their shift closes — otherwise iiko_shift_closed stays
// false forever and a submitted report wrongly shows "смена открыта".
export async function syncCashShifts(config: IikoConfig, daysBack = 3): Promise<number> {
  const now = new Date()
  const from = dateStr(new Date(now.getTime() - daysBack * 86_400_000))
  const to = dateStr(new Date(now.getTime() + 86_400_000))

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

  const nowIso = new Date().toISOString()
  let updated = 0

  for (const [departmentId, establishmentId] of estByDept) {
    try {
      const path = `/resto/api/v2/cashshifts/list` +
        `?openDateFrom=${from}&openDateTo=${to}` +
        `&departmentId=${departmentId}&status=ANY`

      const shifts: CashShift[] = JSON.parse(await iikoFetch(config, path))
      if (!shifts || shifts.length === 0) continue

      // Group shifts by business day (openDate date-part). Each establishment can
      // run several cash registers, so a day has multiple shifts.
      const byDate = new Map<string, CashShift[]>()
      for (const s of shifts) {
        const day = (s.openDate ?? '').slice(0, 10)
        if (!day) continue
        const arr = byDate.get(day) ?? []
        arr.push(s)
        byDate.set(day, arr)
      }

      for (const [date, dayShifts] of byDate) {
        const iiko_total = dayShifts.reduce((sum, s) => sum + (Number(s.payOrders) || 0), 0)
        // The day is "closed" only when every register's shift is no longer OPEN
        const iiko_shift_closed = dayShifts.every(s => s.sessionStatus !== 'OPEN')

        const { error } = await db
          .from('daily_reports')
          .update({ iiko_total, iiko_shift_closed, iiko_synced_at: nowIso })
          .eq('establishment_id', establishmentId)
          .eq('business_date', date)

        if (error) {
          console.warn(`  ! cashshifts update ${establishmentId}/${date}: ${error.message}`)
        } else {
          updated++
        }
      }
    } catch (err) {
      console.warn(`  ! cashshifts ${departmentId}: ${err instanceof Error ? err.message : err}`)
    }
  }

  return updated
}
