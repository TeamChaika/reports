import { IikoHttpError, type IikoConfig } from './auth'
import { getIikoKey, invalidateIikoKey } from './session'

// Re-export so existing imports (`from './client'`) keep working.
export { iikoAuth, iikoLogout, type IikoConfig } from './auth'

// Runs an iiko request with the shared cached key; if the key is rejected
// (401/403 — expired/invalidated), drops it, re-authenticates once and retries.
async function withKeyRetry<T>(config: IikoConfig, fn: (key: string) => Promise<T>): Promise<T> {
  const key = await getIikoKey(config)
  try {
    return await fn(key)
  } catch (err) {
    if (err instanceof IikoHttpError && (err.status === 401 || err.status === 403)) {
      await invalidateIikoKey()
      const freshKey = await getIikoKey(config)
      return fn(freshKey)
    }
    throw err
  }
}

// Returns raw response text — caller decides JSON vs XML
export async function iikoFetch(config: IikoConfig, path: string): Promise<string> {
  return withKeyRetry(config, async key => {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${config.baseUrl}${path}${sep}key=${key}`, {
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new IikoHttpError(res.status, `iiko GET failed: ${res.status} ${path}`)
    return res.text()
  })
}

export async function iikoPost<T>(config: IikoConfig, path: string, body: unknown): Promise<T> {
  return withKeyRetry(config, async key => {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${config.baseUrl}${path}${sep}key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new IikoHttpError(res.status, `iiko POST failed: ${res.status} ${path} — ${errText.slice(0, 300)}`)
    }
    return res.json() as Promise<T>
  })
}
