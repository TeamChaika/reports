import 'server-only'
import { createHash } from 'crypto'
import { createAdminClient } from './supabase/server'

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex')
}

// ── Shared session cache ─────────────────────────────────────────────────────
// The iiko key is stored in a single-row table (id = 1) shared with the worker,
// so both reuse ONE session instead of authenticating per request. Re-auth per
// call exhausts iiko's concurrent-session pool and /resto/api/auth returns 403.
// The key is refreshed once it's older than MAX_AGE_MS.
const SESSION_ID = 1
const MAX_AGE_MS = 15 * 60 * 1000

async function authenticate(): Promise<string> {
  const base = process.env['IIKO_BASE_URL']
  const login = process.env['IIKO_LOGIN']
  const pass = process.env['IIKO_PASSWORD']
  if (!base || !login || !pass) throw new Error('iiko credentials are not configured')

  const res = await fetch(
    `${base}/resto/api/auth?login=${encodeURIComponent(login)}&pass=${sha1(pass)}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) throw new Error(`iiko auth failed: ${res.status}`)
  const key = (await res.text()).trim()
  if (!key || key.startsWith('<') || key.length < 10) throw new Error('iiko auth returned invalid key')
  return key
}

async function logout(key: string): Promise<void> {
  const base = process.env['IIKO_BASE_URL']
  if (!base) return
  try {
    await fetch(`${base}/resto/api/logout?key=${key}`, { signal: AbortSignal.timeout(10_000) })
  } catch {
    // best effort
  }
}

type SessionRow = { key: string; created_at: string }

async function getIikoKey(): Promise<string> {
  const db = createAdminClient()
  const { data } = await db
    .from('iiko_session')
    .select('key, created_at')
    .eq('id', SESSION_ID)
    .maybeSingle<SessionRow>()

  if (data?.key && Date.now() - new Date(data.created_at).getTime() < MAX_AGE_MS) {
    return data.key
  }

  const key = await authenticate()
  await db.from('iiko_session').upsert({ id: SESSION_ID, key, created_at: new Date().toISOString() })
  // Free the previous session slot so it doesn't linger until iiko's idle timeout.
  if (data?.key && data.key !== key) await logout(data.key)
  return key
}

async function invalidateIikoKey(): Promise<void> {
  const db = createAdminClient()
  await db.from('iiko_session').delete().eq('id', SESSION_ID)
}

// POSTs to /employees/byId/{UUID} with the shared key; on 401/403 (expired key)
// drops the cache, re-authenticates once and retries. Returns the raw status +
// body so the caller can map known conflicts to friendly messages.
async function postEmployee(
  base: string,
  id: string,
  body: URLSearchParams,
): Promise<{ status: number; text: string }> {
  const send = async (key: string) => {
    const res = await fetch(`${base}/resto/api/employees/byId/${id}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const text = res.status === 200 || res.status === 201 ? '' : await res.text()
    return { status: res.status, text }
  }

  let result = await send(await getIikoKey())
  if (result.status === 401 || result.status === 403) {
    await invalidateIikoKey()
    result = await send(await getIikoKey())
  }
  return result
}

export type NewWaiter = {
  id: string            // UUID we generate
  code: string          // табельный номер
  name: string          // name in iiko (already includes _sberId if provided)
  pinCode: string
  cardNumber?: string | undefined
  departmentCode: string
}

// Creates an OP1 (официант) employee in iiko via POST /employees/byId/{UUID}.
// POST sets only the provided fields (no backoffice login required, unlike PUT
// which full-replaces and forces login to null → error). New id → 201 Created.
export async function createIikoWaiter(w: NewWaiter): Promise<{ ok: boolean; error?: string }> {
  const base = process.env['IIKO_BASE_URL']
  if (!base) return { ok: false, error: 'iiko не настроен' }

  const body = new URLSearchParams({
    code: w.code,
    name: w.name,
    mainRoleCode: 'OP1',
    roleCodes: 'OP1',
    pinCode: w.pinCode,
    preferredDepartmentCode: w.departmentCode,
    departmentCodes: w.departmentCode,
    employee: 'true',
    supplier: 'false',
    deleted: 'false',
    client: 'false',
  })
  if (w.cardNumber) body.set('cardNumber', w.cardNumber)

  try {
    const { status, text } = await postEmployee(base, w.id, body)
    if (status === 200 || status === 201) return { ok: true }

    // Friendly messages for known conflicts
    if (text.includes('ПИН') || text.toLowerCase().includes('pin')) {
      return { ok: false, error: 'Этот пин-код уже занят — выберите другой' }
    }
    if (status === 409) {
      return { ok: false, error: 'Конфликт: такой код или пин уже существует' }
    }
    return { ok: false, error: `iiko ${status}: ${text.slice(0, 200)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko request failed' }
  }
}

export type WaiterUpdate = {
  name?: string | undefined        // full system name (incl. _sberId)
  cardNumber?: string | undefined  // empty string clears the card
  pinCode?: string | undefined     // omit to keep the current pin
}

// Partial update of an existing employee via POST /employees/byId/{UUID}.
// Only the provided fields change; everything else is left untouched.
export async function updateIikoWaiter(
  id: string,
  fields: WaiterUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const base = process.env['IIKO_BASE_URL']
  if (!base) return { ok: false, error: 'iiko не настроен' }

  const body = new URLSearchParams()
  if (fields.name !== undefined) body.set('name', fields.name)
  if (fields.cardNumber !== undefined) body.set('cardNumber', fields.cardNumber)
  if (fields.pinCode) body.set('pinCode', fields.pinCode)

  if ([...body.keys()].length === 0) return { ok: true } // nothing to change

  try {
    const { status, text } = await postEmployee(base, id, body)
    if (status === 200 || status === 201) return { ok: true }

    if (text.includes('ПИН') || text.toLowerCase().includes('pin')) {
      return { ok: false, error: 'Этот пин-код уже занят — выберите другой' }
    }
    return { ok: false, error: `iiko ${status}: ${text.slice(0, 200)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko request failed' }
  }
}
