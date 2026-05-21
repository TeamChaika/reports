import { createHash } from 'crypto'

export interface IikoConfig {
  baseUrl: string
  login: string
  password: string
}

function sha1(str: string): string {
  return createHash('sha1').update(str).digest('hex')
}

async function authenticate(config: IikoConfig): Promise<string> {
  const url = `${config.baseUrl}/resto/api/auth?login=${encodeURIComponent(config.login)}&pass=${sha1(config.password)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`iiko auth failed: ${res.status}`)
  const key = (await res.text()).trim()
  if (!key || key.startsWith('<') || key.length < 10) throw new Error('iiko auth returned invalid key')
  return key
}

// Returns raw response text — caller decides JSON vs XML
export async function iikoFetch(config: IikoConfig, path: string): Promise<string> {
  const key = await authenticate(config)
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${config.baseUrl}${path}${sep}key=${key}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`iiko GET failed: ${res.status} ${path}`)
  return res.text()
}

export async function iikoPost<T>(config: IikoConfig, path: string, body: unknown): Promise<T> {
  const key = await authenticate(config)
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${config.baseUrl}${path}${sep}key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`iiko POST failed: ${res.status} ${path} — ${err.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}
