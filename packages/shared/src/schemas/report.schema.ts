import { z } from 'zod'

const today = () => new Date().toISOString().split('T')[0] as string
const minDate = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0] as string
}

// Used by both client (RHF resolver) and Server Actions (re-validation)
export const reportFormSchema = z.object({
  establishmentId: z.string().uuid(),
  businessDate: z
    .string()
    .date()
    .refine(d => d <= today(), 'Дата не может быть в будущем')
    .refine(d => d >= minDate(), 'Дата не может быть старше 30 дней'),
  // keyed by payment_groups.id (UUID)
  payGroupAmounts: z.record(z.string().uuid(), z.number().nonnegative()),
  cashSubmitted: z.number().nonnegative().nullable(),
  notes: z.string().max(1000).optional(),
})

export type ReportFormValues = z.infer<typeof reportFormSchema>

export const reportDraftPatchSchema = reportFormSchema.partial()
export type ReportDraftPatch = z.infer<typeof reportDraftPatchSchema>

// Single expense — added individually (collaborative flow)
export const addExpenseSchema = z.object({
  name: z.string().min(1, 'Укажите название').max(200),
  groupId: z.string().uuid().optional(),      // заполняет бухгалтерия, не менеджер
  amount: z.number().positive('Сумма должна быть больше 0'),
  approverId: z.string().uuid().optional(),
  approverName: z.string().optional(),
  description: z.string().max(500).optional(),
})

export type AddExpenseValues = z.infer<typeof addExpenseSchema>
