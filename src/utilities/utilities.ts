import { Request } from 'express'
import { MongoDBConnector } from './mongodb.js'
import { ObjectId, WithId } from 'mongodb'
import { Recipe, RecipeResponseBody, User, UserResponseBody } from './schemas.js'

const mongodb = new MongoDBConnector()

export class MiddlewareChainError extends Error {
  constructor(message: string) { super(message) }
}

export class HTTPError extends Error {
  public status: number
  constructor(status: number, message?: string) {
    super(message)
    this.status = status
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DatabaseError extends Error {
  constructor(message: string) { super(message) }
}

export class MissingAccessTokenError extends HTTPError {
  constructor() { super(401, 'This resource requires authentication') }
}
export class InvalidAccessTokenError extends HTTPError {
  constructor() { super(401, 'Invalid or expired access token') }
}
export class InvalidRefreshTokenError extends HTTPError {
  constructor() { super(401, 'Invalid or expired refresh token') }
}
export class NoPermissionError extends HTTPError {
  // TODO: Consider this as 404 to hide existence of resource to unauthenticated clients
  // constructor() { super(404, 'Resource not found') }
  constructor() { super(403, 'Insufficient permissions to access this resource') }
}

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
