import { changeMyPasswordAction } from './actions'

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const errorText =
    error === 'short' ? 'Пароль должен содержать минимум 8 символов' :
    error === 'mismatch' ? 'Пароли не совпадают' :
    error === 'failed' ? 'Не удалось сменить пароль. Попробуйте ещё раз.' :
    null

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg mb-4 font-bold text-sm"
            style={{
              background: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-border)',
              color: 'var(--color-accent)',
            }}
          >
            CT
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Смена пароля
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Установите новый пароль для вашей учётной записи
          </p>
        </div>

        <div
          className="rounded-xl p-8"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {errorText && (
            <div className="alert alert-danger mb-5" role="alert">
              {errorText}
            </div>
          )}

          <form action={changeMyPasswordAction} className="flex flex-col gap-4">
            <div className="form-group">
              <label htmlFor="password" className="label">Новый пароль</label>
              <input
                id="password"
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                className="input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm" className="label">Повторите пароль</label>
              <input
                id="confirm"
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
            </div>

            <button type="submit" className="btn btn-primary btn--block btn--lg mt-2">
              Сохранить пароль
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
