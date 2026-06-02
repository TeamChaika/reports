'use client'

import { useState, useTransition } from 'react'
import { analyzeReportsAction } from './analyze'

type Props = { from: string; to: string }

export function AiAnalysis({ from, to }: Props) {
  const [isPending, startTransition] = useTransition()
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run() {
    setError(null)
    startTransition(async () => {
      const result = await analyzeReportsAction(from, to)
      if (result.ok && result.analysis) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error ?? 'Ошибка')
        setAnalysis(null)
      }
    })
  }

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            AI-анализ от Claude
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Сравнение трёх источников: отчёт менеджера · iiko · бухгалтерия
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="btn btn-primary btn--sm"
        >
          {isPending ? 'Анализирую…' : analysis ? 'Обновить анализ' : 'Запустить анализ'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger mt-4" role="alert">
          {error}
        </div>
      )}

      {analysis && (
        <div
          className="mt-4 text-sm leading-relaxed"
          style={{
            color: 'var(--color-text)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-sans)',
            borderTop: '1px solid var(--color-border)',
            paddingTop: 'var(--space-4)',
          }}
        >
          {analysis}
        </div>
      )}
    </div>
  )
}
