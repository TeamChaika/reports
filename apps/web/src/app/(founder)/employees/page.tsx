import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import EmployeeTable, { type EmployeeRow } from './EmployeeTable'
import CreateEmployeeForm from './CreateEmployeeForm'
import EstablishmentFilter from './EstablishmentFilter'

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ establishment?: string }>
}) {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder') {
    redirect('/dashboard')
  }

  const { establishment: selectedEstablishment = '' } = await searchParams

  const supabase = await createClient()

  const [{ data: establishments }, { data: rawEmployees }] = await Promise.all([
    supabase
      .from('establishments')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, role, is_active, establishment_users(establishment_id, establishments(id, name))')
      .in('role', ['manager', 'accountant'])
      .order('full_name'),
  ])

  type EstablishmentUserRow = {
    establishment_id: string
    establishments: { id: string; name: string } | null
  }

  type RawEmployee = {
    id: string
    full_name: string | null
    role: string
    is_active: boolean
    establishment_users: EstablishmentUserRow[]
  }

  const typedEmployees = (rawEmployees ?? []) as unknown as RawEmployee[]

  const employees: EmployeeRow[] = typedEmployees
    .map((emp) => ({
      id: emp.id,
      full_name: emp.full_name,
      role: emp.role,
      is_active: emp.is_active,
      establishments: emp.establishment_users
        .filter((eu): eu is EstablishmentUserRow & { establishments: { id: string; name: string } } =>
          eu.establishments !== null,
        )
        .map((eu) => ({ id: eu.establishments.id, name: eu.establishments.name })),
    }))
    .filter((emp) => {
      if (!selectedEstablishment) return true
      return emp.establishments.some((est) => est.id === selectedEstablishment)
    })

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Сотрудники
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Управление менеджерами и бухгалтерами
            </p>
          </div>
          <EstablishmentFilter
            establishments={establishments ?? []}
            selected={selectedEstablishment}
          />
        </div>

        <CreateEmployeeForm establishments={establishments ?? []} />

        <EmployeeTable employees={employees} currentUserId={profile.id} />

      </div>
    </main>
  )
}
