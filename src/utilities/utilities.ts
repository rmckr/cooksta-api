import { Request } from 'express'
import { MongoDBConnector } from './mongodb.js'

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
