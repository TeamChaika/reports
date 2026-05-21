'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReportDraftPatch } from '@shift-reports/shared'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutosave(
  reportId: string | null,
  saveFn: (id: string, patch: ReportDraftPatch) => Promise<{ ok: boolean; error?: string }>,
  delayMs = 1500,
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef(false)

  const save = useCallback(
    (patch: ReportDraftPatch) => {
      if (!reportId) return
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(async () => {
        if (abortRef.current) return
        setStatus('saving')
        const result = await saveFn(reportId, patch)
        if (abortRef.current) return
        setStatus(result.ok ? 'saved' : 'error')
        if (result.ok) {
          setTimeout(() => setStatus('idle'), 2000)
        }
      }, delayMs)
    },
    [reportId, saveFn, delayMs],
  )

  // Cancel pending save on unmount
  useEffect(() => {
    abortRef.current = false
    return () => {
      abortRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { save, status }
}
