import { iikoFetch, type IikoConfig } from './client'
import { db } from '../lib/supabase'

const BATCH = 500

interface RawProduct {
  id?: string
  deleted?: boolean
  name?: string
  num?: string
  code?: string
  parent?: string
  type?: string
  defaultSalePrice?: number
  mainUnit?: string
  category?: string
  accountingCategory?: string
}

export async function syncProducts(config: IikoConfig): Promise<number> {
  const text = await iikoFetch(config, '/resto/api/v2/entities/products/list?includeDeleted=false')
  const raw: RawProduct[] = JSON.parse(text)

  const now = new Date().toISOString()
  const records = raw
    .filter(p => p.id && p.name)
    .map(p => ({
      id: p.id!,
      parent_id: p.parent ?? null,
      code: p.code ?? null,
      num: p.num ?? null,
      name: p.name!,
      type: p.type ?? 'GOODS',
      deleted: p.deleted ?? false,
      default_sale_price: p.defaultSalePrice ?? 0,
      main_unit_id: p.mainUnit ?? null,
      category_id: p.category ?? null,
      accounting_category_id: p.accountingCategory ?? null,
      is_deleted: false,
      synced_at: now,
    }))

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await db.from('iiko_products').upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`sync products batch ${i}: ${error.message}`)
  }
  return records.length
}
