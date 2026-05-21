import { createMD5 } from 'crypto'

interface IikoConfig {
  baseUrl: string
  login: string
  passwordMd5: string
}

async function authenticate(config: IikoConfig): Promise<string> {
  const url = `${config.baseUrl}/resto/api/auth?login=${encodeURIComponent(config.login)}&pass=${config.passwordMd5}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`iiko auth failed: ${res.status}`)
  const key = await res.text()
  if (!key || key.includes('<')) throw new Error('iiko auth returned invalid key')
  return key.trim()
}

async function get<T>(config: IikoConfig, path: string): Promise<T> {
  const key = await authenticate(config)
  const url = `${config.baseUrl}${path}&key=${key}`

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`iiko request failed: ${res.status} ${path}`)

  return res.json() as Promise<T>
}

export { authenticate, get, type IikoConfig }
