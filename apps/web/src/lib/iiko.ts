import 'server-only'
import { createHash } from 'crypto'

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex')
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

export type NewWaiter = {
  id: string            // UUID we generate
  code: string          // табельный номер
  name: string          // name in iiko (already includes _sberId if provided)
  pinCode: string
  cardNumber?: string | undefined
  departmentCode: string
}

// Creates an OP1 (официант) employee in iiko via PUT /employees/byId/{UUID}.
// New id → creates a new employee (201). Full-replace semantics.
export async function createIikoWaiter(w: NewWaiter): Promise<{ ok: boolean; error?: string }> {
  const base = process.env['IIKO_BASE_URL']
  if (!base) return { ok: false, error: 'iiko не настроен' }

  let key: string
  try {
    key = await authenticate()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko auth error' }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<employee>\n` +
    `  <code>${xmlEscape(w.code)}</code>\n` +
    `  <name>${xmlEscape(w.name)}</name>\n` +
    `  <mainRoleCode>OP1</mainRoleCode>\n` +
    `  <roleCodes>OP1</roleCodes>\n` +
    `  <pinCode>${xmlEscape(w.pinCode)}</pinCode>\n` +
    (w.cardNumber ? `  <cardNumber>${xmlEscape(w.cardNumber)}</cardNumber>\n` : `  <cardNumber/>\n`) +
    `  <preferredDepartmentCode>${xmlEscape(w.departmentCode)}</preferredDepartmentCode>\n` +
    `  <departmentCodes>${xmlEscape(w.departmentCode)}</departmentCodes>\n` +
    `  <deleted>false</deleted>\n` +
    `  <supplier>false</supplier>\n` +
    `  <employee>true</employee>\n` +
    `  <client>false</client>\n` +
    `</employee>`

  try {
    const res = await fetch(`${base}/resto/api/employees/byId/${w.id}?key=${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 200 || res.status === 201) return { ok: true }
    const errText = await res.text()
    return { ok: false, error: `iiko ${res.status}: ${errText.slice(0, 200)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'iiko request failed' }
  }
}
