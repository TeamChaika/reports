'use client'

import { useState, useTransition, useRef } from 'react'
import { uploadAccountingFileAction, getDownloadUrlAction, deleteAccountingFileAction } from './fileActions'
import { XlsxViewer } from './XlsxViewer'

type AccountingFile = {
  id: string
  business_date: string
  type: 'nal' | 'bn'
  file_name: string
  created_at: string
}

const TYPE_LABEL = { nal: 'Нал', bn: 'БН' }

// Type colours defined via semantic tokens — these are dark-mode-safe
const TYPE_STYLE = {
  nal: {
    badgeClass: 'badge badge-success',
    buttonBg: 'var(--color-success-bg)',
    buttonBorder: 'var(--color-success-border)',
    buttonColor: 'var(--color-success)',
  },
  bn: {
    badgeClass: 'badge badge-info',
    buttonBg: 'var(--color-info-bg)',
    buttonBorder: 'var(--color-info-border)',
    buttonColor: 'var(--color-info)',
  },
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
        <h2 className="text-sm font-semibold text-text">
          Архив бухгалтерских отчётов
        </h2>
      </div>

      {/* Upload panel */}
      <div
        className="px-5 py-4 flex flex-wrap items-end gap-4"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="form-group">
          <label className="label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Дата отчёта
          </label>
          <input
            type="date"
            value={uploadDate}
            onChange={e => setUploadDate(e.target.value)}
            className="input input--sm"
          />
        </div>

        {(['nal', 'bn'] as const).map(type => {
          const s = TYPE_STYLE[type]
          return (
            <div key={type} className="form-group">
              <label className="label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
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
                className="btn btn--sm"
                style={{
                  background: s.buttonBg,
                  borderColor: s.buttonBorder,
                  color: s.buttonColor,
                  border: `1px solid ${s.buttonBorder}`,
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
        <div
          className="px-5 py-8 text-center"
          style={{ background: 'var(--color-bg)' }}
        >
          <p className="text-sm text-text-muted">
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
                className="px-5 py-3 flex items-center gap-4 transition-colors"
                style={{
                  borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                }}
              >
                <span className="text-sm font-medium shrink-0 w-24 text-text">
                  {formatDate(date)}
                </span>

                {(['nal', 'bn'] as const).map(type => {
                  const file = row[type]
                  const s = TYPE_STYLE[type]
                  return (
                    <div key={type} className="flex items-center gap-2 w-64">
                      {file ? (
                        <>
                          <span
                            className={`${s.badgeClass} flex-1 max-w-full truncate transition-colors`}
                            title={file.file_name}
                          >
                            {TYPE_LABEL[type]}: {file.file_name}
                          </span>
                          <XlsxViewer fileId={file.id} fileName={file.file_name} />
                          <button
                            onClick={() => handleDownload(file.id, file.file_name)}
                            className="btn btn-ghost btn--sm btn--icon shrink-0"
                            title="Скачать"
                            aria-label={`Скачать ${file.file_name}`}
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={isPending}
                            className="btn btn-danger btn--sm btn--icon shrink-0"
                            title="Удалить"
                            aria-label={`Удалить ${file.file_name}`}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted">
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
