import { iikoFetch, type IikoConfig } from './client'
import { parseXmlList, boolVal } from '../lib/xml'
import { db } from '../lib/supabase'

const BATCH = 500

interface RawEmployee {
  id?: unknown
  code?: unknown
  name?: unknown
  mainRoleId?: unknown
  mainRoleCode?: unknown
  cardNumber?: unknown
  preferredDepartmentCode?: unknown
  departmentCodes?: unknown
  deleted?: unknown
  supplier?: unknown
}

export async function syncEmployees(config: IikoConfig): Promise<number> {
  const xml = await iikoFetch(config, '/resto/api/employees')
  const raw = parseXmlList(xml) as RawEmployee[]

  const records = raw
    .filter(e => typeof e.id === 'string' && typeof e.name === 'string')
    .map(e => ({
      id: e.id as string,
      code: typeof e.code === 'string' ? e.code : null,
      name: e.name as string,
      main_role_id: typeof e.mainRoleId === 'string' ? e.mainRoleId : null,
      main_role_code: typeof e.mainRoleCode === 'string' ? e.mainRoleCode : null,
      card_number: typeof e.cardNumber === 'string' ? e.cardNumber : null,
      preferred_department_code:
        typeof e.preferredDepartmentCode === 'string' ? e.preferredDepartmentCode : null,
      department_codes: typeof e.departmentCodes === 'string' ? e.departmentCodes : null,
      deleted: boolVal(e.deleted),
      supplier: boolVal(e.supplier),
      is_deleted: false,
      synced_at: new Date().toISOString(),
    }))

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await db.from('iiko_employees').upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`sync employees batch ${i}: ${error.message}`)
  }
  return records.length
}
