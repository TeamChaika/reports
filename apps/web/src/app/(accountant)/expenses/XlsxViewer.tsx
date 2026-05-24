'use client'

import { useState } from 'react'
import { getDownloadUrlAction } from './fileActions'

type Props = {
  fileId: string
  fileName: string
}

type SheetData = {
  name: string
  rows: (string | number | boolean | null)[][]
}

export function XlsxViewer({ fileId, fileName }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState(0)

  async function handleOpen() {
    if (sheets.length > 0) { setIsOpen(true); return }

    setIsLoading(true)
    setError(null)

    try {
      const result = await getDownloadUrlAction(fileId)
      if (!result.ok || !result.url) throw new Error(result.error ?? 'Ошибка получения файла')

      const resp = await fetch(result.url)
      if (!resp.ok) throw new Error('Ошибка загрузки файла')

      const buffer = await resp.arrayBuffer()
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buffer, { type: 'array' })

      const parsed: SheetData[] = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name]!
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
          header: 1,
          defval: null,
        })
        return { name, rows }
      })

      setSheets(parsed)
      setActiveSheet(0)
      setIsOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setIsLoading(false)
    }
  }

  function handleClose() {
    setIsOpen(false)
  }

  const current = sheets[activeSheet]

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={isLoading}
        className="btn btn-ghost btn--sm btn--icon shrink-0"
        title="Просмотреть"
        aria-label={`Просмотреть ${fileName}`}
      >
        {isLoading ? '…' : '⊞'}
      </button>

      {error && (
        <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</span>
      )}

      {isOpen && current && (
        <div
          className="fixed inset-0 z-modal flex flex-col"
          style={{ background: 'oklch(0% 0 0 / 70%)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div
            className="flex flex-col m-4 rounded-xl overflow-hidden flex-1 min-h-0"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {fileName}
                </span>
                {sheets.length > 1 && (
                  <div className="flex gap-1">
                    {sheets.map((s, i) => (
                      <button
                        key={s.name}
                        onClick={() => setActiveSheet(i)}
                        className={`btn btn--sm ${i === activeSheet ? 'btn-primary' : 'btn-ghost'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="btn btn-ghost btn--sm btn--icon shrink-0"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {/* Sheet content */}
            <div className="overflow-auto flex-1">
              {current.rows.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Лист пустой</p>
                </div>
              ) : (
                <table
                  className="text-xs border-collapse"
                  style={{ color: 'var(--color-text)', minWidth: '100%' }}
                >
                  <tbody>
                    {current.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                      >
                        {/* Row number */}
                        <td
                          className="tabular-nums select-none shrink-0"
                          style={{
                            padding: '4px 8px',
                            color: 'var(--color-text-disabled)',
                            background: 'var(--color-surface)',
                            borderRight: '1px solid var(--color-border)',
                            position: 'sticky',
                            left: 0,
                            minWidth: '2.5rem',
                            textAlign: 'right',
                          }}
                        >
                          {ri + 1}
                        </td>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: '4px 12px',
                              whiteSpace: 'nowrap',
                              borderRight: '1px solid var(--color-border-subtle)',
                              fontWeight: ri === 0 ? 600 : 400,
                              background: ri === 0 ? 'var(--color-surface)' : undefined,
                            }}
                          >
                            {cell === null || cell === undefined ? '' : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2 shrink-0 text-xs"
              style={{
                background: 'var(--color-surface)',
                borderTop: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {current.rows.length} строк · {sheets.length > 1 ? `${sheets.length} листов` : '1 лист'}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
