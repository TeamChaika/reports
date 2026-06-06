import { iikoAuth, iikoLogout, type IikoConfig } from './auth'
import { db } from '../lib/supabase'

// Single-row table (id = 1). The worker AND the web app share this one row so
// they reuse ONE iiko session instead of authenticating per request — re-auth
// per call exhausts iiko's concurrent-session pool and /resto/api/auth then
// returns 403. The key is refreshed once it's older than MAX_AGE_MS.
const SESSION_ID = 1
const MAX_AGE_MS = 15 * 60 * 1000

interface SessionRow {
  key: string
  created_at: string
}

export async function getIikoKey(config: IikoConfig): Promise<string> {
  const { data } = await db
    .from('iiko_session')
    .select('key, created_at')
    .eq('id', SESSION_ID)
    .maybeSingle<SessionRow>()

  if (data?.key && Date.now() - new Date(data.created_at).getTime() < MAX_AGE_MS) {
    return data.key
  }
  return refreshIikoKey(config, data?.key ?? null)
}

async function refreshIikoKey(config: IikoConfig, oldKey: string | null): Promise<string> {
  const key = await iikoAuth(config)
  await db.from('iiko_session').upsert({ id: SESSION_ID, key, created_at: new Date().toISOString() })
  // Free the previous session slot so it doesn't linger until iiko's idle timeout.
  if (oldKey && oldKey !== key) await iikoLogout(config, oldKey)
  return key
}

// Drop the cached key so the next getIikoKey re-authenticates. Call this when an
// API request returns 401/403 — the stored key has expired or been invalidated.
export async function invalidateIikoKey(): Promise<void> {
  await db.from('iiko_session').delete().eq('id', SESSION_ID)
}
