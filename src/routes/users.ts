import express from 'express'
import fs from 'fs'
import multer from 'multer'
import { DatabaseError, normalizeId } from '../utilities/utilities.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import { UserBodySchema, UserIdParamsSchema } from '../utilities/schemas.js'
import { validate } from '../middlewares/validate.js'
import { withUser } from '../middlewares/withUser.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const userRouter = express.Router()
userRouter.use(express.json())

// TODO: Add user search?

userRouter.get(
  '/:userId/avatar',
  withUser,
  async (req, res) => {
    const avatarFile = await mongodb.avatarStorage.find({ 'metadata.contextId': req.user!.id }).next()
    let stream
    if (avatarFile) {
      res.setHeader('Content-Type', avatarFile.metadata?.contentType as string)
      stream = mongodb.avatarStorage.openDownloadStream(avatarFile._id)
        .on('error', () => { throw new DatabaseError('Failed to download file') })
    } else {
      stream = fs.createReadStream('./data/default.png')
    }
    stream.pipe(res.status(200))
  }
)

userRouter.get(
  '/me',
  withUser,
  (req, res) => {
    res.status(200).json(req.user!)
  }
)

/**
 * GET /api/users/<id>/recipes
 * Get all recipes created by this user
 * Parameters: userId
 * Result: Recipe[]
 * NOTE: Will only return private recipes if authentication is provided
 */
userRouter.get(
  '/:userId/recipes',
  withUser,
  async (req, res) => {
    const recipes = await mongodb.recipes.find({ creatorId: req.user!.id }).toArray()
    const result = recipes
      .filter((recipe) => !(recipe.isPrivate && (!req.userToken || req.user!.id !== recipe.creatorId)))
      .map((recipe) => normalizeId(recipe))

    res.status(200).json(result)
  }
)

/**
 * GET /api/users/<id>
 * Get user data by id
 * Parameters: userId
 * Body: none
 */
userRouter.get(
  '/:userId',
  withUser,
  (req, res) => {
    res.status(200).json(req.user!)
  }
)
/**
 * PUT /api/users/<id>
 * Replace an entire user
 * Parameters: userId
 * Body: User (with or without id, id is ignored)
 */
userRouter.put(
  '/:userId',
  withUser,
  validate({ body: UserBodySchema }),
  upload.single('avatar'),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.users.findOneAndReplace({ _id: new ObjectId(req.user!.id) }, body, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to replace user') }

    const user = normalizeId(result)

    if (req.file) { await mongodb.uploadUserAvatar(req.file, user.id) }

    res.status(200).setHeader('Location', `/api/user/${user.id}`).json(user.id)
  }
)
/**
 * PATCH /api/users/<id>
 * Modifies a user partially
 * Parameters: userId
 * Body: User (all fields optional, id is ignored)
 */
userRouter.patch(
  '/:userId',
  withUser,
  validate({ body: UserBodySchema.partial() }),
  upload.single('avatar'),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.user!.id) }, { $set: body }, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to modify user') }

    const user = normalizeId(result)

    if (req.file) { await mongodb.uploadUserAvatar(req.file, req.user!.id) }

    res.status(200).json(user)
  }
)
/**
 * DELETE /api/users/<id>
 * Deletes a user
 * Parameters: userId
 * Body: none
 */
userRouter.delete(
  '/:userId',
  withUser,
  async (req, res) => {
    const result = await mongodb.users.deleteOne({ _id: new ObjectId(req.user!.id) })
    if (!result.acknowledged) { throw new DatabaseError('Delete was not acknowledged') }

    const avatarFile = await mongodb.avatarStorage.find({ metadata: { userId: req.user!.id } }).next()
    if (avatarFile) { await mongodb.avatarStorage.delete(avatarFile._id) }

    res.status(204).end()
  }
)

export default userRouter
