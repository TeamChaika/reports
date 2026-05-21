export interface IikoDepartment {
  id: string
  name: string
  type: string
  parentId: string | null
  isDeleted: boolean
}

export interface IikoPayType {
  id: string
  name: string
  code: string
  combinable: boolean
  isDeleted: boolean
}

export interface IikoEmployee {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  displayName: string
  roles: string[]
  isDeleted: boolean
}

export interface IikoProductGroup {
  id: string
  name: string
  parentId: string | null
  isDeleted: boolean
}

export interface IikoProduct {
  id: string
  name: string
  type: 'DISH' | 'GOODS' | 'MODIFIER'
  groupId: string | null
  price: number | null
  departmentId: string | null
  isDeleted: boolean
}

export interface IikoOlapRow {
  departmentId: string
  openDate: string
  revenue: number
  cash: number
  card: number
  cancellationsSum: number
}

export interface IikoSyncResult {
  syncType: string
  recordsUpserted: number
  recordsSoftDeleted: number
  durationMs: number
}
