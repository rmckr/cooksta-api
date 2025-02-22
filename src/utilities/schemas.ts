import { z } from 'zod'
import { categories } from './utilities.js'

type WithoutId<T> = Omit<T, 'id'>

export const ObjectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, '\'ObjectId\' must be a valid 24-character hexadecimal string')

export const UserIdParamsSchema = z.object({ userId: ObjectIdSchema })
export const RecipeIdParamsSchema = z.object({ recipeId: ObjectIdSchema })

export const UserBodySchema = z.object({
  id: ObjectIdSchema.optional(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  biography: z.string().min(1).max(500),
  favorites: z.array(ObjectIdSchema),
  shoppingList: z.record(
    ObjectIdSchema,
    z.number().int().min(1)
  ),
  isPrivate: z.boolean()
})
export type User = WithoutId<z.infer<typeof UserBodySchema>>
export type UserResponseBody = User & { id: z.infer<typeof ObjectIdSchema> }

export const RecipeBodySchema = z.object({
  id: ObjectIdSchema.optional(),
  creatorId: ObjectIdSchema,
  title: z.string().min(3).max(100),
  description: z.string().min(1),
  ingredients: z.record(
    z.string(),
    z.number().nullable()
  ),
  portions: z.number().int().min(1),
  categories: z.array(
    z.enum(categories)
  ).min(1).max(3),
  isPrivate: z.boolean()
})
export type Recipe = WithoutId<z.infer<typeof RecipeBodySchema>>
export type RecipeResponseBody = Recipe & { id: z.infer<typeof ObjectIdSchema> }

export const RegisterLoginBodySchema = UserBodySchema.pick({ username: true, password: true })
export const RefreshTokenBodySchema = z.object({ refreshToken: z.string().min(1) })

export const RecipeFeedQuerySchema = z.object({
  limit: z.coerce.number().int().nonnegative().max(100).optional()
    .transform((val) => val !== undefined ? String(val) : undefined),
  page: z.coerce.number().int().nonnegative().optional()
    .transform((val) => val !== undefined ? String(val) : undefined),
  sortBy: z.enum(['date', 'popularity']).optional()
})

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().nonnegative().max(100).optional()
    .transform((val) => val !== undefined ? String(val) : undefined),
  page: z.coerce.number().int().nonnegative().optional()
    .transform((val) => val !== undefined ? String(val) : undefined)
})
