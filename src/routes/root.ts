import bcrypt from 'bcrypt'
import express from 'express'
import { DatabaseError, HTTPError, InvalidRefreshTokenError } from '../utilities/errors.js'
import { InsertOneResult, UpdateResult } from 'mongodb'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { RefreshTokenBodySchema, RegisterLoginBodySchema, User } from '../utilities/schemas.js'
import { generateAccessToken, generateRefreshToken, UserJWT, verifyRefreshToken } from '../utilities/jwt.js'
import { normalizeId } from '../utilities/utilities.js'
import { validate } from '../middlewares/validate.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const rootRouter = express.Router()
rootRouter.use(express.json())

/**
 * POST /api/register
 * Registers a new user
 * Parameters: none
 * Body: { username: string, password: string }
 */
rootRouter.post(
  '/register',
  validate({ body: RegisterLoginBodySchema }),
  async (req, res) => {
    const body: User = {
      username: req.body.username,
      password: await bcrypt.hash(req.body.password, 12),
      biography: '',
      favorites: [],
      shoppingList: {},
      isPrivate: false
    }

    if (await mongodb.users.findOne({ username: body.username })) { throw new HTTPError(409, 'Username already taken') }

    const result: InsertOneResult<User> | UpdateResult<User> = await mongodb.users.insertOne(body)
    if (!result.acknowledged) { throw new DatabaseError('Failed to register user') }

    const user = normalizeId(body, result.insertedId)

    res.status(201).setHeader('Location', `/api/user/${user.id}`).json(user)
  }
)

/**
 * POST /api/login
 * Log in as a user
 * Parameters: none
 * Body: { username: string, password: string }
 */
rootRouter.post(
  '/login',
  validate({ body: RegisterLoginBodySchema }),
  async (req, res) => {
    const { username, password } = req.body

    const user = await mongodb.users.findOne({ username: username })
    console.log(user, username, password)
    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new HTTPError(401, 'Invalid username or password')
    }

    const userToken: UserJWT = { id: user._id.toHexString() }
    const accessToken = generateAccessToken(userToken)
    const refreshToken = generateRefreshToken(userToken)

    await mongodb.storeRefreshToken(refreshToken, userToken.id)

    res.status(200).json({
      accessToken: accessToken,
      refreshToken: refreshToken
    })
  }
)

/**
 * POST /api/refresh
 * Refreshes an access token
 * Parameters: none
 * Body: { refreshToken: string }
 */
rootRouter.post(
  '/refresh',
  validate({ body: RefreshTokenBodySchema }),
  async (req, res) => {
    const refreshToken = req.body.refreshToken

    const userToken = verifyRefreshToken(refreshToken)
    if (!userToken) { throw new InvalidRefreshTokenError() }

    const storedToken = await mongodb.refreshTokens.findOne({ token: refreshToken })
    if (!storedToken) { throw new InvalidRefreshTokenError() }

    await mongodb.refreshTokens.deleteOne({ _id: storedToken._id })

    const newAccessToken = generateAccessToken(userToken)
    const newRefreshToken = generateRefreshToken(userToken)

    await mongodb.storeRefreshToken(newRefreshToken, userToken.id)

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    })
  }
)

/**
 * POST /api/logout
 * Terminates a user token
 * Parameters: none
 * Body: { refreshToken: string }
 */
rootRouter.post(
  '/logout',
  validate({ body: RefreshTokenBodySchema }),
  async (req, res) => {
    const refreshToken = req.body.refreshToken

    await mongodb.refreshTokens.deleteOne({ token: refreshToken })

    res.status(200).json({ message: 'Logout successful' })
  }
)

export default rootRouter
