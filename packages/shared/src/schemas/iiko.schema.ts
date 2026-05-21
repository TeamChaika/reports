import { z } from 'zod'

export const iikoDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  parentId: z.string().uuid().nullable().optional(),
  isDeleted: z.boolean(),
})

export const iikoPayTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  combinable: z.boolean(),
  isDeleted: z.boolean(),
})

export const iikoEmployeeSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().nullable().optional(),
  displayName: z.string(),
  roles: z.array(z.string()),
  isDeleted: z.boolean(),
})

export const iikoProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['DISH', 'GOODS', 'MODIFIER']),
  parentGroup: z.string().uuid().nullable().optional(),
  price: z.number().nullable().optional(),
  isDeleted: z.boolean(),
})

export type IikoDepartmentRaw = z.infer<typeof iikoDepartmentSchema>
export type IikoEmployeeRaw = z.infer<typeof iikoEmployeeSchema>
export type IikoProductRaw = z.infer<typeof iikoProductSchema>
