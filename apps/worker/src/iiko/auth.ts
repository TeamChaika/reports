import { createHash } from 'crypto'

export interface IikoConfig {
  baseUrl: string
  login: string
  password: string
}

// Carries the HTTP status so callers can react to 401/403 (expired/invalid key)
// and retry with a fresh session instead of failing the whole sync.
export class IikoHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'IikoHttpError'
  }
}

function sha1(str: string): string {
  return createHash('sha1').update(str).digest('hex')
}

export async function iikoAuth(config: IikoConfig): Promise<string> {
  const url = `${config.baseUrl}/resto/api/auth?login=${encodeURIComponent(config.login)}&pass=${sha1(config.password)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new IikoHttpError(res.status, `iiko auth failed: ${res.status}`)
  const key = (await res.text()).trim()
  if (!key || key.startsWith('<') || key.length < 10) throw new Error('iiko auth returned invalid key')
  return key
}

// Release the iiko session so we don't exhaust the concurrent-session pool.
export async function iikoLogout(config: IikoConfig, key: string): Promise<void> {
  try {
    await fetch(`${config.baseUrl}/resto/api/logout?key=${key}`, { signal: AbortSignal.timeout(10_000) })
  } catch {
    // best effort
  }
}
