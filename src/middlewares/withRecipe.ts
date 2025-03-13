import { HTTPError, MiddlewareChainError, MissingAccessTokenError, NoPermissionError } from '../utilities/errors.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import { RecipeIdParamsSchema } from '../utilities/schemas.js'
import { RequestHandler, Router } from 'express'
import { authenticate } from './authenticate.js'
import { normalizeId } from '../utilities/utilities.js'
import { validate } from './validate.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const getRecipe: RequestHandler<{ recipeId?: string }> = async (req, _res, next) => {
  if (req.userToken === undefined) { throw new MiddlewareChainError('\'withRecipe\' depends on \'authenticate\' middleware') }
  if (!req.isValidated) { throw new MiddlewareChainError('\'withRecipe\' depends on \'validate\' middleware') }

  // This shouldn't ever happen if `validate` is properly used before, so this is mostly just type-guarding...
  if (!req.params.recipeId) { throw new HTTPError(400, 'Missing "recipeId" request parameter') }

  const recipe = await mongodb.recipes.findOne({ _id: new ObjectId(req.params.recipeId) })

  if (!recipe) { throw new HTTPError(404, 'Recipe not found') }

  req.recipe = normalizeId(recipe)

  if (req.recipe.isPrivate || req.method !== 'GET') {
    if (!req.userToken) { throw new MissingAccessTokenError() }
    if (req.userToken.id !== req.recipe.creatorId) { throw new NoPermissionError() }
  }

  next()
}

/**
 * withUser middleware
 * 1. Authenticates request
 * 2. Safely retrieves recipe from MongoDB
 * 3. If recipe is private, check for authorization
 * @description `req.recipe` can safely be considered as defined after this.
 */
export const withRecipe = Router({ mergeParams: true }).use(authenticate, validate({ params: RecipeIdParamsSchema }), getRecipe)
