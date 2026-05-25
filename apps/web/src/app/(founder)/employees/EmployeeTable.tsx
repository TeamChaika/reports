import { toggleEmployeeActiveAction } from './actions'

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
  if (role === 'accountant') {
    return <span className="badge badge-info">Бухгалтер</span>
  }
  return <span className="badge badge-neutral">Менеджер</span>
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return <span className="badge badge-success">Активен</span>
  }
  return <span className="badge badge-neutral">Неактивен</span>
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
          <p className="empty-state-description">
            Добавьте первого сотрудника через форму выше
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-x-auto"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div>
        <table className="data-table" style={{ minWidth: '600px' }}>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Роль</th>
              <th>Заведения</th>
              <th>Статус</th>
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
                  <td>
                    <RoleBadge role={emp.role} />
                  </td>
                  <td>
                    {emp.establishments.length === 0 ? (
                      <span style={{ color: 'var(--color-text-disabled)' }}>—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {emp.establishments.map((est) => (
                          <span key={est.id} className="tag">
                            {est.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge isActive={emp.is_active} />
                  </td>
                  <td>
                    {isSelf ? (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--color-text-disabled)' }}
                      >
                        Вы
                      </span>
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
    </div>
  )
}
