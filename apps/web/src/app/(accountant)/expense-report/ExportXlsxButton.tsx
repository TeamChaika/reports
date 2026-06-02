'use client'

import { useState } from 'react'

export type CategoryRow = { name: string; total: number; count: number }
export type EstablishmentRow = { name: string; total: number; count: number }
export type DetailRow = {
  date: string
  establishment: string
  name: string
  category: string
  approver: string
  amount: number
}

type Props = {
  from: string
  to: string
  total: number
  byCategory: CategoryRow[]
  byEstablishment: EstablishmentRow[]
  details: DetailRow[]
}

export function ExportXlsxButton({ from, to, total, byCategory, byEstablishment, details }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    // Heavy library — load only on demand
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Sheet 1: По категориям
    const catAoa: (string | number)[][] = [
      [`Расходы за ${from} — ${to}`],
      [],
      ['Категория', 'Сумма, ₽', 'Доля %', 'Кол-во'],
      ...byCategory.map(c => [
        c.name,
        Math.round(c.total),
        total > 0 ? Math.round((c.total / total) * 100) : 0,
        c.count,
      ]),
      [],
      ['ИТОГО', Math.round(total), 100, details.length],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catAoa), 'По категориям')

    // Sheet 2: По заведениям
    const estAoa: (string | number)[][] = [
      ['Заведение', 'Сумма, ₽', 'Кол-во'],
      ...byEstablishment.map(e => [e.name, Math.round(e.total), e.count]),
      [],
      ['ИТОГО', Math.round(total), details.length],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(estAoa), 'По заведениям')

    // Sheet 3: Детализация
    const detAoa: (string | number)[][] = [
      ['Дата', 'Заведение', 'Расход', 'Категория', 'Согласовал', 'Сумма, ₽'],
      ...details.map(d => [d.date, d.establishment, d.name, d.category, d.approver, Math.round(d.amount)]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detAoa), 'Детализация')

    XLSX.writeFile(wb, `Расходы_${from}_${to}.xlsx`)
    setBusy(false)
  }

  return (
    <button type="button" onClick={handleExport} disabled={busy} className="btn btn-primary btn--sm">
      {busy ? 'Готовлю…' : 'Скачать Excel'}
    </button>
  )
}
