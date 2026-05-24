'use client'

import { useRef, useState, useTransition } from 'react'
import { createEmployeeAction } from './actions'

type Establishment = { id: string; name: string }

type Props = {
  establishments: Establishment[]
}

export default function CreateEmployeeForm({ establishments }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createEmployeeAction(formData)
      if (result.ok) {
        setSuccess(true)
        formRef.current?.reset()
      } else {
        setError(result.error ?? 'Произошла ошибка')
      }
    })
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Добавить сотрудника
        </h2>
        <button
          type="button"
          className="btn btn-secondary btn--sm"
          onClick={() => {
            setIsOpen((prev) => !prev)
            setError(null)
            setSuccess(false)
          }}
        >
          {isOpen ? 'Свернуть' : '+ Добавить сотрудника'}
        </button>
      </div>

      {isOpen && (
        <div
          className="px-5 pb-5"
          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
        >
          {error && (
            <div className="alert alert-danger mt-4" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success mt-4" role="status">
              Сотрудник успешно добавлен
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="emp-full-name" className="label label--required">
                  Полное имя
                </label>
                <input
                  id="emp-full-name"
                  name="full_name"
                  type="text"
                  className="input"
                  placeholder="Иван Петров"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="emp-email" className="label label--required">
                  E-mail
                </label>
                <input
                  id="emp-email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="ivan@example.com"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="emp-password" className="label label--required">
                  Пароль
                </label>
                <input
                  id="emp-password"
                  name="password"
                  type="password"
                  className="input"
                  placeholder="Минимум 8 символов"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="emp-role" className="label label--required">
                  Роль
                </label>
                <select
                  id="emp-role"
                  name="role"
                  className="input input--select"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Выберите роль
                  </option>
                  <option value="manager">Менеджер</option>
                  <option value="accountant">Бухгалтер</option>
                </select>
              </div>

              <div className="form-group sm:col-span-2">
                <label htmlFor="emp-establishment" className="label label--required">
                  Заведение
                </label>
                <select
                  id="emp-establishment"
                  name="establishment_id"
                  className="input input--select"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Выберите заведение
                  </option>
                  {establishments.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <span className="spinner spinner--sm" aria-hidden="true" />
                    Создание...
                  </>
                ) : (
                  'Создать сотрудника'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
