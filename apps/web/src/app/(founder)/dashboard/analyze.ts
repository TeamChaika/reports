'use server'

import OpenAI from 'openai'
import * as XLSX from 'xlsx'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'accounting-reports'
const AI_MODEL = 'anthropic/claude-sonnet-4-6'
const MAX_CSV_CHARS = 8000 // cap per accounting file to keep the prompt bounded

type AnalyzeResult = { ok: boolean; analysis?: string; error?: string }

function getAiClient(): OpenAI | null {
  const apiKey = process.env['OPENROUTER_API_KEY']
  if (!apiKey || apiKey === 'your-openrouter-key') return null
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env['NEXT_PUBLIC_APP_URL'] ?? '',
      'X-Title': 'Shift Reports Analytics',
    },
  })
}

async function xlsxToText(bytes: ArrayBuffer): Promise<string> {
  const wb = XLSX.read(new Uint8Array(bytes), { type: 'array' })
  const parts: string[] = []
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    if (!sheet) continue
    const csv = XLSX.utils.sheet_to_csv(sheet)
    parts.push(`### Лист "${name}"\n${csv.slice(0, MAX_CSV_CHARS)}`)
  }
  return parts.join('\n\n')
}

export async function analyzeReportsAction(
  from: string,
  to: string,
): Promise<AnalyzeResult> {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') {
    return { ok: false, error: 'Недостаточно прав' }
  }

  const client = getAiClient()
  if (!client) {
    return { ok: false, error: 'AI не настроен: добавьте OPENROUTER_API_KEY в переменные окружения' }
  }

  const supabase = await createClient()

  // ── Source 1+2: manager reports + iiko ────────────────────────────────────
  const { data: reports } = await supabase
    .from('daily_reports')
    .select(`
      business_date, status,
      revenue_cash, revenue_card, revenue_other, revenue_total,
      cash_submitted, iiko_total, iiko_shift_closed,
      establishments!inner(name)
    `)
    .gte('business_date', from)
    .lte('business_date', to)
    .neq('status', 'draft')
    .order('business_date', { ascending: true })

  const reportLines = (reports ?? []).map(r => {
    const est = (r.establishments as unknown as { name: string }).name
    const total = Number(r.revenue_total ?? 0)
    const iiko = r.iiko_total != null ? Number(r.iiko_total) : null
    const diff = iiko != null ? total - iiko : null
    return {
      date: r.business_date,
      establishment: est,
      manager: {
        cash: Number(r.revenue_cash ?? 0),
        card: Number(r.revenue_card ?? 0),
        other: Number(r.revenue_other ?? 0),
        total,
        cash_submitted: r.cash_submitted != null ? Number(r.cash_submitted) : null,
      },
      iiko: {
        total: iiko,
        shift_closed: r.iiko_shift_closed ?? null,
      },
      diff,
    }
  })

  // ── Source 3: accounting xlsx (nal/bn) ────────────────────────────────────
  const admin = createAdminClient()
  const { data: files } = await admin
    .from('accounting_files')
    .select('business_date, type, file_name, storage_path')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: true })

  const accountingParts: string[] = []
  for (const f of files ?? []) {
    try {
      const { data: blob } = await admin.storage.from(BUCKET).download(f.storage_path)
      if (!blob) continue
      const text = await xlsxToText(await blob.arrayBuffer())
      const label = f.type === 'nal' ? 'Наличные' : 'Безналичные'
      accountingParts.push(`## Бухгалтерия — ${label} (${f.business_date}) — ${f.file_name}\n${text}`)
    } catch {
      // skip unreadable file, continue with the rest
    }
  }

  if (reportLines.length === 0 && accountingParts.length === 0) {
    return { ok: false, error: 'Нет данных за выбранный период' }
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const systemPrompt = `Ты — финансовый аналитик сети ресторанов «Чайка». Тебе дают три независимых источника данных по выручке за период:
1. Отчёт менеджера (введён вручную): наличные / безналичные / прочее.
2. Данные iiko (касса): итог по кассовым сменам, флаг закрытия смены.
3. Файлы бухгалтерии (выгрузки нал/безнал из xlsx).

Сравни источники, найди расхождения и аномалии, оцени риски (недосдача наличных, незакрытые смены, расхождение бухгалтерии с кассой). Отвечай на русском, структурировано в markdown: краткое резюме, таблица расхождений по заведениям/датам, выявленные проблемы, конкретные рекомендации. Используй числа. Будь лаконичен.`

  const userPayload = [
    `Период: ${from} — ${to}`,
    '',
    '## Отчёты менеджеров + iiko (JSON):',
    JSON.stringify(reportLines, null, 2),
    '',
    accountingParts.length > 0
      ? accountingParts.join('\n\n')
      : '## Бухгалтерия: файлов за период нет',
  ].join('\n')

  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload },
      ],
    })
    const analysis = completion.choices[0]?.message?.content
    if (!analysis) return { ok: false, error: 'Пустой ответ от AI' }
    return { ok: true, analysis }
  } catch (err) {
    return { ok: false, error: `Ошибка AI: ${err instanceof Error ? err.message : 'неизвестно'}` }
  }
}
