import { HTTPError, MiddlewareChainError, MissingAccessTokenError, NoPermissionError } from '../utilities/utilities.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import { RequestHandler, Router } from 'express'
import { UserIdParamsSchema } from '../utilities/schemas.js'
import { authenticate } from './authenticate.js'
import { validate } from './validate.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const getUser: RequestHandler<{ userId?: string }> = async (req, _res, next) => {
  if (req.userToken === undefined) { throw new MiddlewareChainError('\'withUser\' depends on \'authenticate\' middleware') }
  if (!req.isValidated) { throw new MiddlewareChainError('\'withUser\' depends on \'validate\' middleware') }

  const userId = req.params.userId ?? req.userToken?.id
  if (!userId) { throw new HTTPError(400, 'Missing request parameter or authentication') }

  const user = await mongodb.users.findOne({ _id: new ObjectId(userId) })

  if (!user) { throw new HTTPError(404, 'User not found') }

  const { _id, ...userData } = user
  req.user = Object.assign(userData, { id: _id.toHexString() })

  if (req.user.isPrivate) {
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
