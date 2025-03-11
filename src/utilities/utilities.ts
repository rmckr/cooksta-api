import { MongoDBConnector } from './mongodb.js'
import { ObjectId, WithId } from 'mongodb'
import { Recipe, RecipeResponseBody, User, UserResponseBody } from './schemas.js'
import { Request } from 'express'

const mongodb = new MongoDBConnector()

export const categories = ['asian', 'baking', 'dessert', 'drink', 'main', 'italian', 'quick', 'soup', 'vegetarian'] as const

export function normalizeId(recipe: WithId<Recipe>): RecipeResponseBody
export function normalizeId(user: WithId<User>): UserResponseBody
export function normalizeId(recipe: Recipe, id: ObjectId): RecipeResponseBody
export function normalizeId(user: User, id: ObjectId): UserResponseBody
export function normalizeId<T extends WithId<Recipe> | WithId<User> | Recipe | User>(userOrRecipe: T, id?: ObjectId): Omit<T, '_id'> & { id: string } {
  if ('_id' in userOrRecipe) {
    const { _id, ...rest } = userOrRecipe
    return Object.assign(rest, { id: _id.toHexString() })
  } else {
    return Object.assign(userOrRecipe, { id: id!.toHexString() })
  }
}

export async function handleRecipeMedia(req: Request<{ recipeId: string }>) {
  const files = req.files as unknown as { image?: Express.Multer.File, video?: Express.Multer.File } | undefined
  const imageFile = files?.image
  const videoFile = files?.video

  if (imageFile) {
    await mongodb.uploadRecipeImage(imageFile, req.params.recipeId)
  }
  if (videoFile) {
    await mongodb.uploadRecipeVideo(videoFile, req.params.recipeId)
  }
}
