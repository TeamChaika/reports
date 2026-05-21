import { iikoFetch, type IikoConfig } from './client'
import { parseXmlList } from '../lib/xml'
import { db } from '../lib/supabase'

interface RawStore {
  id?: unknown
  parentId?: unknown
  code?: unknown
  name?: unknown
  type?: unknown
}

export async function syncStores(config: IikoConfig): Promise<number> {
  const xml = await iikoFetch(config, '/resto/api/corporation/stores')
  const raw = parseXmlList(xml) as RawStore[]

  const records = raw
    .filter(s => typeof s.id === 'string' && typeof s.name === 'string')
    .map(s => ({
      id: s.id as string,
      parent_id: typeof s.parentId === 'string' ? s.parentId : null,
      code: typeof s.code === 'string' ? s.code : null,
      name: s.name as string,
      type: typeof s.type === 'string' ? s.type : 'STORE',
      is_deleted: false,
      synced_at: new Date().toISOString(),
    }))

  const { error } = await db.from('iiko_stores').upsert(records, { onConflict: 'id' })
  if (error) throw new Error(`sync stores failed: ${error.message}`)
  return records.length
}
