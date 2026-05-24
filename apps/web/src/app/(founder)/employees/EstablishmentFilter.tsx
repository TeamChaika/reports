'use client'

import { useRouter } from 'next/navigation'

type Establishment = { id: string; name: string }

type Props = {
  establishments: Establishment[]
  selected: string
}

export default function EstablishmentFilter({ establishments, selected }: Props) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    router.push('/employees' + (val ? '?establishment=' + val : ''))
  }

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="establishment-filter"
        className="text-sm shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Заведение
      </label>
      <select
        id="establishment-filter"
        className="input input--select"
        style={{ width: '200px' }}
        value={selected}
        onChange={handleChange}
      >
        <option value="">Все заведения</option>
        {establishments.map((est) => (
          <option key={est.id} value={est.id}>
            {est.name}
          </option>
        ))}
      </select>
    </div>
  )
}
