import 'server-only'
import { createHash } from 'crypto'

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex')
}

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

// Release the iiko session — otherwise every waiter create/edit leaks a session
// and the concurrent-session pool fills up → auth starts returning 403.
async function logout(key: string): Promise<void> {
  const base = process.env['IIKO_BASE_URL']
  if (!base) return
  try {
    await fetch(`${base}/resto/api/logout?key=${key}`, { signal: AbortSignal.timeout(10_000) })
  } catch {
    // best effort
  }
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

  let key: string
  try {
    key = await authenticate()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko auth error' }
  }

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
    const res = await fetch(`${base}/resto/api/employees/byId/${w.id}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 200 || res.status === 201) return { ok: true }

    const errText = await res.text()
    // Friendly messages for known conflicts
    if (errText.includes('ПИН') || errText.toLowerCase().includes('pin')) {
      return { ok: false, error: 'Этот пин-код уже занят — выберите другой' }
    }
    if (res.status === 409) {
      return { ok: false, error: 'Конфликт: такой код или пин уже существует' }
    }
    return { ok: false, error: `iiko ${res.status}: ${errText.slice(0, 200)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko request failed' }
  } finally {
    await logout(key)
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

  let key: string
  try {
    key = await authenticate()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko auth error' }
  }

  const body = new URLSearchParams()
  if (fields.name !== undefined) body.set('name', fields.name)
  if (fields.cardNumber !== undefined) body.set('cardNumber', fields.cardNumber)
  if (fields.pinCode) body.set('pinCode', fields.pinCode)

  if ([...body.keys()].length === 0) {
    await logout(key)
    return { ok: true } // nothing to change
  }

  try {
    const res = await fetch(`${base}/resto/api/employees/byId/${id}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 200 || res.status === 201) return { ok: true }

    const errText = await res.text()
    if (errText.includes('ПИН') || errText.toLowerCase().includes('pin')) {
      return { ok: false, error: 'Этот пин-код уже занят — выберите другой' }
    }
    return { ok: false, error: `iiko ${res.status}: ${errText.slice(0, 200)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko request failed' }
  } finally {
    await logout(key)
  }
}
