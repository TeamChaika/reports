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
  salesCash: number
  salesCard: number
  conception: string | null
  pointOfSale: string | null
}

export async function syncCashShifts(
  config: IikoConfig,
  forDate?: string,
): Promise<number> {
  const date = forDate ?? dateStr(new Date())
  const tomorrow = dateStr(new Date(new Date(date).getTime() + 86_400_000))

  // Load active establishments with iiko_department_id
  const { data: establishments, error: estError } = await db
    .from('establishments')
    .select('id, iiko_department_id')
    .not('iiko_department_id', 'is', null)
    .eq('is_active', true)
  if (estError) throw new Error(`fetch establishments: ${estError.message}`)
  if (!establishments || establishments.length === 0) return 0

  // Map iiko_department_id → establishment.id
  const estByDept = new Map(
    establishments.map(e => [e.iiko_department_id as string, e.id as string]),
  )

  const now = new Date().toISOString()
  let updated = 0

  for (const [departmentId, establishmentId] of estByDept) {
    try {
      const path = `/resto/api/v2/cashshifts/list` +
        `?openDateFrom=${date}&openDateTo=${tomorrow}` +
        `&departmentId=${departmentId}&status=ANY`

      const text = await iikoFetch(config, path)
      const shifts: CashShift[] = JSON.parse(text)

      if (!shifts || shifts.length === 0) continue

      // Pick the most relevant shift for this business date:
      // prefer CLOSED/ACCEPTED, fallback to OPEN
      const closed = shifts.find(s =>
        s.sessionStatus === 'CLOSED' ||
        s.sessionStatus === 'ACCEPTED' ||
        s.sessionStatus === 'UNACCEPTED' ||
        s.sessionStatus === 'HASWARNINGS'
      )
      const shift = closed ?? shifts[0]
      if (!shift) continue

      const iiko_total = Number(shift.payOrders) || 0
      const iiko_shift_closed = shift.sessionStatus !== 'OPEN'

      const { error } = await db
        .from('daily_reports')
        .update({ iiko_total, iiko_shift_closed, iiko_synced_at: now })
        .eq('establishment_id', establishmentId)
        .eq('business_date', date)

      if (error) {
        console.warn(`  ! cashshifts update ${establishmentId}/${date}: ${error.message}`)
      } else {
        updated++
      }
    } catch (err) {
      console.warn(`  ! cashshifts ${departmentId}: ${err instanceof Error ? err.message : err}`)
    }
  }

  return updated
}
