import { z } from 'zod'

export const reportExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  employeeId: z.string().uuid().nullable().optional(),
})

export const reportPrepaymentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  eventDate: z.string().date().nullable().optional(),
})

export const createReportSchema = z.object({
  establishmentId: z.string().uuid(),
  businessDate: z.string().date(),
  shift: z.enum(['morning', 'evening', 'full']).nullable().optional(),
  revenueTotal: z.number().nonnegative(),
  revenueMarket: z.number().nonnegative().nullable().optional(),
  cash: z.number().nonnegative(),
  card: z.number().nonnegative(),
  prepaymentsTotal: z.number().nonnegative().nullable().optional(),
  expensesTotal: z.number().nonnegative(),
  submittedToAccounting: z.number().nonnegative(),
  expenses: z.array(reportExpenseSchema).max(50),
  prepayments: z.array(reportPrepaymentSchema).max(20).optional(),
  source: z.enum(['web_form', 'telegram', 'xlsx']),
})

export type CreateReportInput = z.infer<typeof createReportSchema>
