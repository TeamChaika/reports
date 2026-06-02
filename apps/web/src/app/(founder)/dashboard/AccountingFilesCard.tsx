'use client'

import { useState } from 'react'
import { getDownloadUrlAction } from '@/app/(accountant)/expenses/fileActions'

export type AccountingFile = {
  id: string
  business_date: string
  type: string // 'nal' | 'bn'
  file_name: string
}

type Props = { files: AccountingFile[] }

const TYPE_LABEL: Record<string, string> = { nal: 'Наличные', bn: 'Безналичные' }

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('ru', {
    day: 'numeric',
    month: 'long',
  })
}

export function AccountingFilesCard({ files }: Props) {
  const [busy, setBusy] = useState<string | null>(null)

  async function download(id: string) {
    setBusy(id)
    try {
      const result = await getDownloadUrlAction(id)
      if (result.ok && result.url) window.open(result.url, '_blank')
    } finally {
      setBusy(null)
    }
  }

  // Group by date
  const byDate = new Map<string, AccountingFile[]>()
  for (const f of files) {
    if (!byDate.has(f.business_date)) byDate.set(f.business_date, [])
    byDate.get(f.business_date)!.push(f)
  }
  const dates = [...byDate.keys()].sort().reverse()

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        Бухгалтерия
      </h2>

      {dates.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          За период нет загруженных файлов
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {dates.map(date => {
            const dayFiles = byDate.get(date)!
            return (
              <div key={date} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {formatDate(date)}
                </span>
                <div className="flex gap-1.5">
                  {(['nal', 'bn'] as const).map(type => {
                    const file = dayFiles.find(f => f.type === type)
                    if (!file) {
                      return (
                        <span
                          key={type}
                          className="badge badge-neutral"
                          style={{ opacity: 0.5 }}
                        >
                          {TYPE_LABEL[type]}: нет
                        </span>
                      )
                    }
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => download(file.id)}
                        disabled={busy === file.id}
                        className="badge badge-info"
                        style={{ cursor: 'pointer' }}
                      >
                        {busy === file.id ? '…' : `${TYPE_LABEL[type]} ↓`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
