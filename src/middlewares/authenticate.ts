import { InvalidAccessTokenError, MissingAccessTokenError } from '../utilities/errors.js'
import { RequestHandler } from 'express'
import { verifyAccessToken } from '../utilities/jwt.js'

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.split(' ')?.at(1)
  if (!token) {
    // Allow no token for read-only requests
    if (req.method === 'GET') {
      req.userToken = null
      return next()
    }
    throw new MissingAccessTokenError()
  }

  const userToken = verifyAccessToken(token)
  if (!userToken) {
    throw new InvalidAccessTokenError()
  }

  req.userToken = userToken
  next()
}
