import { RequestHandler } from 'express'
import { IRoute } from 'express-serve-static-core'
import { z, ZodSchema } from 'zod'
import { HTTPError } from '../utilities/utilities.js'

export function validate<TParams extends ZodSchema, TBody extends ZodSchema>(schemas: { params?: TParams, body?: TBody }): RequestHandler<z.infer<TParams>, unknown, z.infer<TBody>> {
  return (req, _res, next) => {
    const hasRouteParams = (req.route as IRoute).path.includes(':')
    if (schemas.params && hasRouteParams) {
      const parsed = schemas.params.safeParse(req.params)
      if (parsed.error) {
        throw new HTTPError(400, `Invalid request parameters: ${parsed.error.message}`)
      }
      req.params = parsed.data as z.infer<TParams>
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body)
      if (parsed.error) {
        throw new HTTPError(400, `Invalid request body: ${parsed.error.message}`)
      }
      req.body = parsed.data as z.infer<TBody>
    }

    req.isValidated = true
    next()
  }
}
