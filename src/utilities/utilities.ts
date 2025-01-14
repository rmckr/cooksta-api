import { z, ZodSchema } from 'zod'
import { RequestHandler, Response } from 'express'
import { MongoError, ObjectId } from 'mongodb'
import { RecipeIdParamsSchema, UserIdParamsSchema } from './schemas'
import { MongoDBConnector } from './mongodb'

const mongodb = new MongoDBConnector()

export type InferSchema<S> = S extends ZodSchema ? z.infer<S> : unknown

export function validate<TParams, TBody>(schemas: { params?: TParams, body?: TBody }): RequestHandler<InferSchema<TParams>, unknown, InferSchema<TBody>> {
  return (req, res, next) => {
    const errors: Record<string, string>[] = []
    for (const [key, schema] of Object.entries(schemas) as [keyof typeof schemas, typeof schemas[keyof typeof schemas]][]) {
      if (!(schema instanceof ZodSchema)) { continue }
      const parsed = schema.safeParse(req[key] ?? {})
      if (parsed.success) {
        req[key] = parsed.data as z.infer<typeof schema>
      } else {
        errors.push({ [key]: parsed.error.message })
      }
    }
    if (errors.length > 0) {
      res.status(500).json({ error: 'Invalid request', errors: errors })
      return
    }
    next()
  }
}

export function withRecipe(requireOwnerPermission = false): RequestHandler<InferSchema<typeof RecipeIdParamsSchema>> {
  return (req, res, next) => {
    void mongodb.recipes.findOne({ _id: new ObjectId(req.params.recipeId) })
      .then((recipe) => {
        if (!recipe) {
          res.status(404).json({ error: 'Not found' })
          return
        }
        if (recipe.isPrivate || requireOwnerPermission) {
          if (!req.session.user) {
            res.status(401)
            throw new Error('Unauthorized')
          }
          if (req.session.user.id !== recipe.creatorId) {
            res.status(403)
            throw new Error('Forbidden')
          }
        }
        const { _id, ...recipeData } = recipe
        req.recipe = Object.assign(recipeData, { id: _id.toHexString() })
        next()
      })
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
}
export function withUser(requireOwnerPermission = false): RequestHandler<InferSchema<typeof UserIdParamsSchema>> {
  return (req, res, next) => {
    void mongodb.users.findOne({ _id: new ObjectId(req.params.userId) })
      .then((user) => {
        if (!user) {
          res.status(404)
          throw new Error('Not found')
        }
        /* if (user.isPrivate || requireOwnerPermission) {
          if (!req.session.user) {
            res.status(401)
            throw new Error('Unauthorized')
          }
          if (req.session.user.id !== req.params.userId) {
            res.status(403)
            throw new Error('Forbidden')
          }
        } */
        const { _id, ...userData } = user
        req.user = Object.assign(userData, { id: _id.toHexString() })
        next()
      })
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
}
export function withOwnerUser() {
  return withUser(true)
}

export function defaultErrorResponse(res: Response, error?: MongoError | Error) {
  if (res.statusCode === 200) { res.status(500) }
  res.json({ error: error?.message ?? 'Unknown error' })
}
