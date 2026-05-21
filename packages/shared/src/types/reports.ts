export type ReportStatus = 'draft' | 'submitted' | 'verified'
export type ReportSource = 'web_form' | 'telegram' | 'xlsx'
export type UserRole = 'manager' | 'accountant' | 'founder' | 'admin'

export interface DailyReport {
  id: string
  establishmentId: string
  businessDate: string
  shift: 'morning' | 'evening' | 'full' | null
  formConfigVersion: number
  revenueTotal: number | null
  revenueMarket: number | null
  cash: number | null
  card: number | null
  prepaymentsTotal: number | null
  expensesTotal: number | null
  submittedToAccounting: number | null
  status: ReportStatus
  source: ReportSource | null
  submittedBy: string | null
  submittedAt: string | null
  createdAt: string
}

export interface ReportExpense {
  id: string
  reportId: string
  position: number | null
  amount: number
  description: string | null
  employeeId: string | null
  isVerified: boolean
}

export interface ReportPrepayment {
  id: string
  reportId: string
  amount: number
  description: string | null
  eventDate: string | null
}

export interface Establishment {
  id: string
  name: string
  formConfig: EstablishmentFormConfig
  formConfigVersion: number
  createdAt: string
}

export interface EstablishmentFormConfig {
  prepayments: boolean
  tableware: boolean
  cancellations: boolean
}
