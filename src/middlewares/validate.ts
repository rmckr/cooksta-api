import { RequestHandler } from 'express'
import { IRoute } from 'express-serve-static-core'
import { z, ZodSchema } from 'zod'
import { HTTPError } from '../utilities/utilities.js'

export function validate<
  TParams extends ZodSchema,
  TBody extends ZodSchema,
  TQuery extends ZodSchema
>(schemas: { params?: TParams, body?: TBody, query?: TQuery }): RequestHandler<z.infer<TParams>, unknown, z.infer<TBody>, z.infer<TQuery>> {
  return (req, _res, next) => {
    const hasRouteParams = (req.route as IRoute).path.includes(':')
    if (schemas.params && hasRouteParams) {
      const parsed = schemas.params.safeParse(req.params)
      if (parsed.error) {
        throw new HTTPError(400, `Invalid request parameters: ${parsed.error.message}`)
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body)
      if (parsed.error) {
        throw new HTTPError(400, `Invalid request body: ${parsed.error.message}`)
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query)
      if (!parsed.success) {
        throw new HTTPError(400, `Invalid query parameters: ${parsed.error.message}`)
      }
    }

    req.isValidated = true
    next()
  }
}
