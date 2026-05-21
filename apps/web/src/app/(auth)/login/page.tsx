import { loginAction } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-border)' }}
      >
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Shift Reports</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>Войдите чтобы продолжить</p>

        <form action={loginAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Пароль</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--color-accent)' }}
          >
            Войти
          </button>
        </form>
      </div>
    </main>
  )
}
