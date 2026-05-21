// Types aligned with Supabase DB schema (migrations 20260521000002)

export type ReportStatus = 'draft' | 'submitted' | 'reviewed' | 'approved'
export type ReportSource = 'web' | 'telegram'
export type UserRole = 'manager' | 'accountant' | 'founder' | 'admin'

export interface DailyReport {
  id: string
  establishmentId: string
  businessDate: string
  status: ReportStatus
  source: ReportSource
  submittedBy: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string | null
  // Revenue (mirrors DB columns)
  revenueCash: number
  revenueCard: number
  revenueOther: number
  revenueTotal: number  // generated: cash + card + other
  cashStart: number | null
  cashEnd: number | null
  // iiko reconciliation
  iikoTotal: number | null
  iikoSyncedAt: string | null
  iikoDiff: number  // generated: revenue_total - coalesce(iiko_total, 0)
  createdAt: string
  updatedAt: string
}

export interface ReportItem {
  id: string
  reportId: string
  payType: string
  amount: number
  createdAt: string
}

export interface ReportExpense {
  id: string
  reportId: string
  category: string
  description: string | null
  amount: number
  createdAt: string
}

export interface ReportPrepayment {
  id: string
  reportId: string
  employeeId: string | null
  employeeName: string
  amount: number
  createdAt: string
}

export interface Establishment {
  id: string
  iikoDepaertmentId: string | null
  name: string
  code: string | null
  telegramChatId: number | null
  isActive: boolean
  config: EstablishmentConfig
  createdAt: string
}

export interface EstablishmentConfig {
  prepayments?: boolean
  expenses?: boolean
  cashTracking?: boolean
}

export interface Profile {
  id: string
  fullName: string | null
  role: UserRole
  telegramId: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}
