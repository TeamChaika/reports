'use client'

import { useState } from 'react'
import { toggleEmployeeActiveAction, changePasswordAction } from './actions'

export type EmployeeRow = {
  id: string
  full_name: string | null
  role: string
  is_active: boolean
  establishments: { id: string; name: string }[]
}

type Props = {
  employees: EmployeeRow[]
  currentUserId: string
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'accountant') return <span className="badge badge-info">Бухгалтер</span>
  return <span className="badge badge-neutral">Менеджер</span>
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) return <span className="badge badge-success">Активен</span>
  return <span className="badge badge-neutral">Неактивен</span>
}

function PasswordCell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setStatus('loading')
    setError('')
    const result = await changePasswordAction(userId, password)
    if (result.ok) {
      setStatus('ok')
      setPassword('')
      setTimeout(() => { setOpen(false); setStatus('idle') }, 1500)
    } else {
      setStatus('error')
      setError(result.error ?? 'Ошибка')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn--sm btn-ghost"
      >
        Сменить пароль
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5" style={{ minWidth: '180px' }}>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Новый пароль"
        className="input input--sm"
        autoFocus
      />
      {status === 'error' && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}
      {status === 'ok' && (
        <p className="text-xs" style={{ color: 'var(--color-success)' }}>Сохранено</p>
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status === 'loading' || password.length < 8}
          className="btn btn--sm btn-primary"
        >
          {status === 'loading' ? '...' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPassword(''); setStatus('idle') }}
          className="btn btn--sm btn-ghost"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

export default function EmployeeTable({ employees, currentUserId }: Props) {
  if (employees.length === 0) {
    return (
      <div
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="empty-state">
          <p className="empty-state-title">Нет сотрудников</p>
          <p className="empty-state-description">Добавьте первого сотрудника через форму выше</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-x-auto"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <table className="data-table" style={{ minWidth: '700px' }}>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Роль</th>
            <th>Заведения</th>
            <th>Статус</th>
            <th>Пароль</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const isSelf = emp.id === currentUserId
            const toggleActive = toggleEmployeeActiveAction.bind(null, emp.id, !emp.is_active)

            return (
              <tr key={emp.id}>
                <td>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {emp.full_name ?? '—'}
                  </span>
                </td>
                <td><RoleBadge role={emp.role} /></td>
                <td>
                  {emp.establishments.length === 0 ? (
                    <span style={{ color: 'var(--color-text-disabled)' }}>—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {emp.establishments.map((est) => (
                        <span key={est.id} className="tag">{est.name}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td><StatusBadge isActive={emp.is_active} /></td>
                <td>
                  {isSelf ? (
                    <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>—</span>
                  ) : (
                    <PasswordCell userId={emp.id} />
                  )}
                </td>
                <td>
                  {isSelf ? (
                    <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>Вы</span>
                  ) : (
                    <form action={toggleActive}>
                      <button
                        type="submit"
                        className={`btn btn--sm ${emp.is_active ? 'btn-danger' : 'btn-success'}`}
                      >
                        {emp.is_active ? 'Деактивировать' : 'Активировать'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
