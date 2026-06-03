'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUserOrRedirect } from '@/lib/auth'
import { createIikoWaiter, updateIikoWaiter } from '@/lib/iiko'

// Department codes of the establishments the current manager is assigned to
async function managerDeptCodes(userId: string): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: links } = await supabase
    .from('establishment_users')
    .select('establishments(iiko_department_id)')
    .eq('user_id', userId)
  const deptIds = (links ?? [])
    .map(l => (l.establishments as unknown as { iiko_department_id: string | null })?.iiko_department_id)
    .filter(Boolean) as string[]
  if (deptIds.length === 0) return new Set()
  const admin = createAdminClient()
  const { data: depts } = await admin.from('iiko_departments').select('code').in('id', deptIds)
  return new Set((depts ?? []).map(d => String(d.code)))
}

export type CreateWaiterInput = {
  name: string
  sberTipsId?: string | undefined
  cardNumber?: string | undefined
  pinCode: string
  establishmentId: string
}

export async function createWaiterAction(
  input: CreateWaiterInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUserOrRedirect()

  const name = input.name?.trim() ?? ''
  if (name.length < 2) return { ok: false, error: 'Укажите имя' }

  const pin = (input.pinCode ?? '').trim()
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: 'Пин-код — 4–6 цифр' }

  const sber = (input.sberTipsId ?? '').trim()
  if (sber && !/^\d{6,}$/.test(sber)) return { ok: false, error: 'Неверный идентификатор Сбер Чаевых' }

  const card = (input.cardNumber ?? '').trim()
  if (card && !/^[\w-]{1,40}$/.test(card)) return { ok: false, error: 'Неверный номер карты' }

  const supabase = await createClient()

  // The manager may only create waiters in establishments they are assigned to.
  // RLS on establishment_users already scopes this read to the current user.
  const { data: link } = await supabase
    .from('establishment_users')
    .select('establishment_id, establishments(iiko_department_id)')
    .eq('user_id', user.id)
    .eq('establishment_id', input.establishmentId)
    .single()

  if (!link) return { ok: false, error: 'Нет доступа к этому заведению' }

  const iikoDeptId = (link.establishments as unknown as { iiko_department_id: string | null })?.iiko_department_id
  if (!iikoDeptId) return { ok: false, error: 'У заведения нет привязки к iiko' }

  const admin = createAdminClient()

  // Resolve iiko department CODE (employees use the numeric code, not the UUID)
  const { data: dept } = await admin
    .from('iiko_departments')
    .select('code, name')
    .eq('id', iikoDeptId)
    .single()
  if (!dept?.code) return { ok: false, error: 'Не найден код подразделения iiko' }

  // Generate a fresh табельный номер (max numeric code + 1)
  const { data: codes } = await admin
    .from('iiko_employees')
    .select('code')
    .not('code', 'is', null)
    .limit(5000)
  // Cap at < 100000 — some employees store a phone number in `code`, which would
  // otherwise inflate the next табельный номер to an 11-digit value.
  let maxCode = 0
  for (const c of codes ?? []) {
    const n = parseInt(String(c.code), 10)
    if (Number.isFinite(n) && n > maxCode && n < 100000) maxCode = n
  }
  const code = String(maxCode + 1)

  // Sber Tips: identifier is appended to the system name as "_<id>"
  const systemName = sber ? `${name}_${sber}` : name

  const id = randomUUID()

  // Write to iiko (creates the employee in the live system)
  const result = await createIikoWaiter({
    id,
    code,
    name: systemName,
    pinCode: pin,
    cardNumber: card || undefined,
    departmentCode: String(dept.code),
  })
  if (!result.ok) return { ok: false, error: result.error ?? 'iiko отклонил создание' }

  // Mirror into iiko_employees so the waiter shows immediately (worker reconciles on next sync)
  await admin.from('iiko_employees').upsert({
    id,
    code,
    name: systemName,
    main_role_code: 'OP1',
    preferred_department_code: String(dept.code),
    department_codes: String(dept.code),
    deleted: false,
    supplier: false,
  })

  // Audit: who created which waiter
  await admin.from('waiter_audit_log').insert({
    action: 'create',
    iiko_employee_id: id,
    employee_name: systemName,
    establishment_id: input.establishmentId,
    performed_by: user.id,
    details: { code, has_sber: Boolean(sber), has_card: Boolean(card) },
  })

  revalidatePath('/waiters')
  return { ok: true }
}

export type UpdateWaiterInput = {
  iikoId: string
  name: string             // base name (without _sberId)
  sberTipsId?: string | undefined
  cardNumber?: string | undefined
  pinCode?: string | undefined  // empty → keep current pin
}

export async function updateWaiterAction(
  input: UpdateWaiterInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUserOrRedirect()

  const name = input.name?.trim() ?? ''
  if (name.length < 2) return { ok: false, error: 'Укажите имя' }

  const sber = (input.sberTipsId ?? '').trim()
  if (sber && !/^\d{6,}$/.test(sber)) return { ok: false, error: 'Неверный идентификатор Сбер Чаевых' }

  const pin = (input.pinCode ?? '').trim()
  if (pin && !/^\d{4,6}$/.test(pin)) return { ok: false, error: 'Пин-код — 4–6 цифр' }

  const card = (input.cardNumber ?? '').trim()
  if (card && !/^[\w-]{1,40}$/.test(card)) return { ok: false, error: 'Неверный номер карты' }

  const admin = createAdminClient()

  // The waiter must belong to one of the manager's establishments
  const { data: emp } = await admin
    .from('iiko_employees')
    .select('id, department_codes, main_role_code')
    .eq('id', input.iikoId)
    .single()
  if (!emp) return { ok: false, error: 'Официант не найден' }
  if (emp.main_role_code !== 'OP1') return { ok: false, error: 'Можно редактировать только официантов (OP1)' }

  const allowed = await managerDeptCodes(user.id)
  if (!allowed.has(String(emp.department_codes))) {
    return { ok: false, error: 'Нет доступа к этому официанту' }
  }

  const systemName = sber ? `${name}_${sber}` : name

  const result = await updateIikoWaiter(input.iikoId, {
    name: systemName,
    cardNumber: card,
    pinCode: pin || undefined,
  })
  if (!result.ok) return { ok: false, error: result.error ?? 'iiko отклонил изменение' }

  // Mirror the visible fields locally (pin/card aren't stored in iiko_employees)
  await admin.from('iiko_employees').update({ name: systemName }).eq('id', input.iikoId)

  // Resolve establishment by the waiter's department code for the audit row
  const { data: depRow } = await admin
    .from('iiko_departments')
    .select('id')
    .eq('code', String(emp.department_codes))
    .single()
  let estId: string | null = null
  if (depRow) {
    const { data: estRow } = await admin
      .from('establishments')
      .select('id')
      .eq('iiko_department_id', depRow.id)
      .single()
    estId = estRow?.id ?? null
  }

  // Audit: who edited which waiter and what changed
  await admin.from('waiter_audit_log').insert({
    action: 'update',
    iiko_employee_id: input.iikoId,
    employee_name: systemName,
    establishment_id: estId,
    performed_by: user.id,
    details: { name_changed: true, sber_changed: Boolean(sber), card_changed: Boolean(card), pin_changed: Boolean(pin) },
  })

  revalidatePath('/waiters')
  return { ok: true }
}
