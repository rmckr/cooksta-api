import { z } from 'zod'

type WithoutId<T> = Omit<T, 'id'>

export const ObjectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, '\'ObjectId\' must be a valid 24-character hexadecimal string')

export const UserIdParamsSchema = z.object({ userId: ObjectIdSchema })
export const RecipeIdParamsSchema = z.object({ recipeId: ObjectIdSchema })

export const UserBodySchema = z.object({
  id: ObjectIdSchema.optional(),
  username: z.string().min(3, { message: '\'username\' must be a string with a minimum length of 3' }),
  password: z.string().min(1, { message: '\'password\' must be a non-empty string' }),
  biography: z.string().min(1, { message: '\'biography\' must be a non-empty string' }),
  favorites: z.array(ObjectIdSchema, { message: '\'favorites\' must be an array of recipe ObjectIds' }),
  shoppingList: z
    .array(
      z.object({
        recipeId: ObjectIdSchema,
        servings: z.number().int().min(1, { message: '\'shoppingList.servings\' must be an integer of at least 1' })
      }),
      { message: '\'shoppingList\' must be an array of objects with keys recipeId and servings' }
    ),
  isPrivate: z.boolean({ message: '\'isPrivate\' must be a boolean' })
})
export type User = WithoutId<z.infer<typeof UserBodySchema>>
export type UserResponseBody = User & { id: z.infer<typeof ObjectIdSchema> }

export const RecipeBodySchema = z.object({
  id: ObjectIdSchema.optional(),
  creatorId: ObjectIdSchema,
  title: z.string().min(3, { message: '\'title\' must be a string with a minimum length of 3' }),
  description: z.string().min(1, { message: '\'description\' must be a non-empty string' }),
  instructions: z.string().min(1, { message: '\'instructions\' must be a non-empty string' }),
  ingredientsList: z.array(z.string(), { message: '\'ingredientsList\' must be an array of strings' }), // non-empty list and strings
  categories: z.array(z.string(), { message: '\'categories\' must be an array of strings' }), // Min 1 Max 3
  isPrivate: z.boolean({ message: '\'isPrivate\' must be a boolean' })
})
export type Recipe = WithoutId<z.infer<typeof RecipeBodySchema>>
export type RecipeResponseBody = Recipe & { id: z.infer<typeof ObjectIdSchema> }

export const RegisterLoginBodySchema = UserBodySchema.pick({ username: true, password: true })
export const RefreshTokenBodySchema = z.object({ refreshToken: z.string().min(1, '\'refreshToken\' must be a non-empty string') })
