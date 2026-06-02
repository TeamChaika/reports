import { loginAction } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo mark + app name */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg mb-4 font-bold text-sm"
            style={{
              background: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-border)',
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: 'var(--tracking-wide)',
            }}
          >
            CT
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            Chaika Team
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Войдите чтобы продолжить
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Error banner */}
          {error && (
            <div
              className="alert alert-danger mb-5"
              role="alert"
            >
              {error === 'invalid'
                ? 'Неверный логин или пароль'
                : error === 'missing'
                ? 'Введите номер телефона и пароль'
                : error === 'ratelimit'
                ? 'Слишком много попыток входа. Подождите минуту.'
                : 'Ошибка входа. Попробуйте ещё раз.'}
            </div>
          )}

          <form action={loginAction} className="flex flex-col gap-4">
            <div className="form-group">
              <label htmlFor="login" className="label">
                Номер телефона или email
              </label>
              <input
                id="login"
                type="text"
                name="login"
                required
                autoComplete="username"
                placeholder="79781234567 или email@example.com"
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Введите номер телефона или email
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="label">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="input"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn--block btn--lg mt-2"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
