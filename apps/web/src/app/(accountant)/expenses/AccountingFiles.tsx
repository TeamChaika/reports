'use client'

import { useState, useTransition, useRef } from 'react'
import { uploadAccountingFileAction, getDownloadUrlAction, deleteAccountingFileAction } from './fileActions'

type AccountingFile = {
  id: string
  business_date: string
  type: 'nal' | 'bn'
  file_name: string
  created_at: string
}

const TYPE_LABEL = { nal: 'Нал', bn: 'БН' }
const TYPE_COLOR = {
  nal: { bg: 'oklch(93% 0.06 145)', color: 'oklch(38% 0.15 145)', border: 'oklch(78% 0.12 145)' },
  bn: { bg: 'oklch(93% 0.06 250)', color: 'oklch(38% 0.15 250)', border: 'oklch(78% 0.12 250)' },
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('ru', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

export function AccountingFiles({ files }: { files: AccountingFile[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10))
  const nalRef = useRef<HTMLInputElement>(null)
  const bnRef = useRef<HTMLInputElement>(null)

  // Group files by date
  const byDate = files.reduce<Record<string, { nal?: AccountingFile; bn?: AccountingFile }>>((acc, f) => {
    if (!acc[f.business_date]) acc[f.business_date] = {}
    acc[f.business_date]![f.type] = f
    return acc
  }, {})

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  async function handleUpload(type: 'nal' | 'bn', file: File) {
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    fd.append('businessDate', uploadDate)

    startTransition(async () => {
      const result = await uploadAccountingFileAction(fd)
      if (!result.ok) setError(result.error ?? 'Ошибка загрузки')
    })
  }

  async function handleDownload(fileId: string, fileName: string) {
    const result = await getDownloadUrlAction(fileId)
    if (!result.ok || !result.url) { setError(result.error ?? 'Ошибка'); return }
    const a = document.createElement('a')
    a.href = result.url
    a.download = fileName
    a.click()
  }

  async function handleDelete(fileId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteAccountingFileAction(fileId)
      if (!result.ok) setError(result.error ?? 'Ошибка удаления')
    })
  }

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-3"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Архив бухгалтерских отчётов
        </h2>
      </div>

      {/* Upload panel */}
      <div
        className="px-5 py-4 flex flex-wrap items-end gap-4"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Дата отчёта
          </label>
          <input
            type="date"
            value={uploadDate}
            onChange={e => setUploadDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {(['nal', 'bn'] as const).map(type => {
          const c = TYPE_COLOR[type]
          return (
            <div key={type}>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {TYPE_LABEL[type]}-отчёт (xlsx)
              </label>
              <input
                ref={type === 'nal' ? nalRef : bnRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(type, file)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => (type === 'nal' ? nalRef : bnRef).current?.click()}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: c.bg,
                  color: c.color,
                  border: `1px solid ${c.border}`,
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Загрузка…' : `↑ Загрузить ${TYPE_LABEL[type]}`}
              </button>
            </div>
          )
        })}

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
      </div>

      {/* Archive table */}
      {dates.length === 0 ? (
        <div className="px-5 py-8 text-center" style={{ background: 'var(--color-bg)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Файлы ещё не загружены
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-bg)' }}>
          {dates.map((date, i) => {
            const row = byDate[date]!
            return (
              <div
                key={date}
                className="px-5 py-3 flex items-center gap-4"
                style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}
              >
                <span
                  className="text-sm font-medium shrink-0 w-24"
                  style={{ color: 'var(--color-text)' }}
                >
                  {formatDate(date)}
                </span>

                {(['nal', 'bn'] as const).map(type => {
                  const file = row[type]
                  const c = TYPE_COLOR[type]
                  return (
                    <div key={type} className="flex items-center gap-2 w-64">
                      {file ? (
                        <>
                          <span
                            className="text-xs font-medium px-2 py-1 rounded-md flex-1 truncate"
                            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
                            title={file.file_name}
                          >
                            {TYPE_LABEL[type]}: {file.file_name}
                          </span>
                          <button
                            onClick={() => handleDownload(file.id, file.file_name)}
                            className="text-xs shrink-0"
                            style={{ color: 'var(--color-accent)' }}
                            title="Скачать"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={isPending}
                            className="text-xs shrink-0"
                            style={{ color: 'var(--color-text-muted)' }}
                            title="Удалить"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {TYPE_LABEL[type]}: —
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
