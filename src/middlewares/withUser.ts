import { HTTPError, MiddlewareChainError, MissingAccessTokenError, NoPermissionError } from '../utilities/errors.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import { RequestHandler, Router } from 'express'
import { authenticate } from './authenticate.js'
import { normalizeId } from '../utilities/utilities.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const getUser: RequestHandler<{ userId?: string }> = async (req, _res, next) => {
  if (req.userToken === undefined) { throw new MiddlewareChainError('\'getUser\' depends on \'authenticate\' middleware') }

  let userId
  if (req.params.userId === 'me' || /\/me(\/|$)/.test(req.path)) {
    if (!req.userToken) { throw new MissingAccessTokenError() }
    userId = req.userToken.id
  } else {
    if (!req.params.userId) { throw new HTTPError(400, 'Missing "userId" request parameter') }
    userId = req.params.userId
  }

  const user = await mongodb.users.findOne({ _id: new ObjectId(userId) })

  if (!user) { throw new HTTPError(404, 'User not found') }

  req.user = normalizeId(user)

  if (req.user.isPrivate || req.method !== 'GET') {
    if (!req.userToken) { throw new MissingAccessTokenError() }
    if (req.userToken.id !== req.user.id) { throw new NoPermissionError() }
  }

  next()
}

/**
 * withUser middleware
 * 1. Authenticates request
 * 2. Safely retrieves user from MongoDB
 * 3. If user is private, check for authorization
 * @description `req.user` can safely be considered as defined after this.
 */
export const withUser = Router({ mergeParams: true }).use(authenticate, getUser)
