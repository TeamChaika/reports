import { iikoFetch, type IikoConfig } from './client'
import { parseXmlList } from '../lib/xml'
import { db } from '../lib/supabase'

interface RawDept {
  id?: unknown
  parentId?: unknown
  code?: unknown
  name?: unknown
  type?: unknown
}

export async function syncDepartments(config: IikoConfig): Promise<number> {
  const xml = await iikoFetch(config, '/resto/api/corporation/departments')
  const raw = parseXmlList(xml) as RawDept[]

  const records = raw
    .filter(d => typeof d.id === 'string' && typeof d.name === 'string')
    .map(d => ({
      id: d.id as string,
      parent_id: typeof d.parentId === 'string' ? d.parentId : null,
      code: typeof d.code === 'string' ? d.code : null,
      name: d.name as string,
      type: typeof d.type === 'string' ? d.type : 'DEPARTMENT',
      is_deleted: false,
      synced_at: new Date().toISOString(),
    }))

  const { error } = await db.from('iiko_departments').upsert(records, { onConflict: 'id' })
  if (error) throw new Error(`sync departments failed: ${error.message}`)
  return records.length
}
