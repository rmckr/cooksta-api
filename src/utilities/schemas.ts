import { z } from 'zod'

export const ObjectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, '\'ObjectId\' must be a valid 24-character hexadecimal string')

export const UserIdParamsSchema = z.object({ userId: ObjectIdSchema })

export const UserSchema = z.object({
  id: ObjectIdSchema,
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
export type UserSchemaType = z.infer<typeof UserSchema>
export type User = Omit<UserSchemaType, 'id'>

export const RecipeIdParamsSchema = z.object({ recipeId: ObjectIdSchema })

export const RecipeSchema = z.object({
  id: ObjectIdSchema.optional(),
  creatorId: ObjectIdSchema,
  title: z.string().min(3, { message: '\'title\' must be a string with a minimum length of 3' }),
  description: z.string().min(1, { message: '\'description\' must be a non-empty string' }),
  instructions: z.string().min(1, { message: '\'instructions\' must be a non-empty string' }),
  ingredientsList: z.array(z.string(), { message: '\'ingredientsList\' must be an array of strings' }), // non-empty list and strings
  categories: z.array(z.string(), { message: '\'categories\' must be an array of strings' }), // Min 1 Max 3
  isPrivate: z.boolean({ message: '\'isPrivate\' must be a boolean' })
})
export type RecipeSchemaType = z.infer<typeof RecipeSchema>
export type Recipe = Omit<RecipeSchemaType, 'id'>
