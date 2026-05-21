import { z } from 'zod'

/**
 * Upsert DTOs for RemarkStyleSet. `code` is a free string — it mirrors
 * flight-trips-api's dynamic remark codes, so we deliberately do NOT
 * validate it against a hardcoded enum (that staleness is the problem
 * this feature kills). Colors are free CSS color strings; fontWeight is
 * a standard 100–900 step.
 */
const remarkStyleEntry = z.object({
  code: z.string().min(1, 'code must not be empty'),
  background: z.string().nullable().optional(),
  textColor: z.string().nullable().optional(),
  fontWeight: z.number().int().min(100).max(900).nullable().optional(),
})

export const createRemarkStyleSetSchema = z.object({
  name: z.string().min(1, 'name must not be empty'),
  isDefault: z.boolean().optional(),
  entries: z.array(remarkStyleEntry).default([]),
})

export type CreateRemarkStyleSetDto = z.infer<typeof createRemarkStyleSetSchema>

export const updateRemarkStyleSetSchema = z.object({
  name: z.string().min(1, 'name must not be empty').optional(),
  isDefault: z.boolean().optional(),
  entries: z.array(remarkStyleEntry).optional(),
})

export type UpdateRemarkStyleSetDto = z.infer<typeof updateRemarkStyleSetSchema>
