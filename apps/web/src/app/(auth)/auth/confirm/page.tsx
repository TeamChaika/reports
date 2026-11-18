import type { Metadata } from 'next'
import { confirmInvitation } from './actions'

export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } }

export default async function ConfirmInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }>
}) {
  const { token_hash: tokenHash, type } = await searchParams
  const valid = type === 'invite' && typeof tokenHash === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(tokenHash)

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl p-8" style={{ background: 'var(--color-surface)' }}>
        <h1 className="text-xl font-semibold mb-4">Приглашение в отчёты</h1>
        {valid ? (
          <form action={confirmInvitation}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <button type="submit" className="btn btn-primary btn--block">Принять приглашение</button>
          </form>
        ) : (
          <p role="status">Ссылка недействительна. Попросите администратора отправить новое приглашение.</p>
        )}
      </div>
    </main>
  )
}
