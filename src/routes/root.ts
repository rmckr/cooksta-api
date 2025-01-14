import express from 'express'
import bcrypt from 'bcrypt'
import { InsertOneResult, MongoError, UpdateResult } from 'mongodb'
import { MongoDBConnector } from '../utilities/mongodb'
import { defaultErrorResponse, validate } from '../utilities/utilities'
import { User, UserSchema } from '../utilities/schemas'

const mongodb = new MongoDBConnector()

const rootRouter = express.Router()
rootRouter.use(express.json())

rootRouter.post(
  '/register',
  validate({ body: UserSchema }),
  (req, res) => {
    async function insertUser() {
      const { id, ...body } = {
        ...req.body,
        favorites: req.body.favorites ?? [],
        shoppingList: req.body.shoppingList ?? [],
        isPrivate: req.body.isPrivate ?? true
      }
      if (await mongodb.users.findOne({ username: body.username })) { throw new Error('Username already taken') }
      const result: InsertOneResult<User> | UpdateResult<User> = await mongodb.users.insertOne(body)
      if (!result.acknowledged) { throw new Error('Insert was not acknowledged') }

      return Object.assign(body, { id: result.insertedId.toHexString() })
    }

    insertUser()
      .then((user) => res.status(201).setHeader('Location', `/api/user/${user.id}`).json(user))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

rootRouter.post(
  '/login',
  validate({ body: UserSchema }),
  (req, res) => {
    async function loginUser() {
      const { username, password } = req.body
      const user = await mongodb.users.findOne({ username })
      if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid username or password' })
      }

      req.session.user = { id: user._id.toHexString(), username: user.username }
    }
    loginUser()
      .then(() => res.status(200).json({ message: 'Login successful' }))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

rootRouter.post(
  '/logout',
  (req, res) => {
    req.session.destroy((error) => {
      if (error) { return res.status(500).json({ error: 'Failed to log out' }) }
      res.status(200).json({ message: 'Logged out successfully' })
    })
  }
)

export default rootRouter
