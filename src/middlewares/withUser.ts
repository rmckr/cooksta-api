import { HTTPError, MiddlewareChainError, MissingAccessTokenError, NoPermissionError } from '../utilities/errors.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import { RequestHandler, Router } from 'express'
import { UserIdParamsSchema } from '../utilities/schemas.js'
import { authenticate } from './authenticate.js'
import { normalizeId } from '../utilities/utilities.js'
import { validate } from './validate.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const getUser: RequestHandler<{ userId: string }> = async (req, _res, next) => {
  if (req.userToken === undefined) { throw new MiddlewareChainError('\'withUser\' depends on \'authenticate\' middleware') }
  if (!req.isValidated) { throw new MiddlewareChainError('\'withUser\' depends on \'validate\' middleware') }

  let userId
  if (req.params.userId === 'me') {
    if (!req.userToken) { throw new MissingAccessTokenError() }
    userId = req.userToken.id
  } else {
    if (!req.params.userId) { throw new HTTPError(400, 'Missing request parameter') }
    userId = req.params.userId
  }

  const user = await mongodb.users.findOne({ _id: new ObjectId(userId) })

  if (!user) { throw new HTTPError(404, 'User not found') }

  req.user = normalizeId(user)

  // TODO: This is really hacky. Think about a better solution.
  if (req.user.isPrivate && !req.path.includes('/avatar')) {
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
export const withUser = Router({ mergeParams: true }).use(authenticate, validate({ params: UserIdParamsSchema }), getUser)
