import express from 'express'
import fs from 'fs'
import multer from 'multer'
import { DatabaseError } from '../utilities/utilities.js'
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


// TODO: Improve search with query parameters
/* userRouter.get(
  '/search/:query',
  (req, res) => {
    function escapeRegex(text: string) {
      return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
    }
    async function queryAllUsers() {
      return mongodb.users
        .find({ username: { $regex: escapeRegex(req.params.query), $options: 'i' } })
        .project({ _id: 0, username: 1 })
        .toArray()
    }
    queryAllUsers()
      .then((users) => res.json(users))
      .catch((error: DatabaseError | Error) => errorResponse(res, error))
  }
) */
userRouter.get(
  '/:userId/avatar',
  withUser,
  async (req, res) => {
    const avatarFile = await mongodb.avatarStorage.find({ 'metadata.contextId': req.user!.id }).next()
    let stream
    if (avatarFile) {
      res.setHeader('Content-Type', avatarFile.metadata?.contentType as string)
      stream = mongodb.avatarStorage.openDownloadStream(avatarFile._id)
        .on('error', () => { throw new DatabaseError('Failed to download image') })
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
 * GET /api/users/<id>
 * Get user data by id
 * Parameters: userId
 * Body: none
 */
userRouter.get(
  '/:userId',
  validate({ params: UserIdParamsSchema }),
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
  validate({ params: UserIdParamsSchema, body: UserBodySchema }),
  upload.single('avatar'),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.users.findOneAndReplace({ _id: new ObjectId(req.params.userId) }, body, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to replace user') }

    const { _id, ...modifiedData } = result
    const user = Object.assign(modifiedData, { id: _id.toHexString() })

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
  validate({ params: UserIdParamsSchema, body: UserBodySchema }),
  upload.single('avatar'),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.params.userId) }, { $set: body }, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to modify user') }

    const { _id, ...modifiedData } = result
    const user = Object.assign(modifiedData, { id: _id.toHexString() })

    if (req.file) { await mongodb.uploadUserAvatar(req.file, req.params.userId) }

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
  validate({ params: UserIdParamsSchema }),
  async (req, res) => {
    const result = await mongodb.users.deleteOne({ _id: new ObjectId(req.params.userId) })
    if (!result.acknowledged) { throw new DatabaseError('Delete was not acknowledged') }

    const avatarFile = await mongodb.avatarStorage.find({ metadata: { userId: req.params.userId } }).next()
    if (avatarFile) { await mongodb.avatarStorage.delete(avatarFile._id) }

    res.status(204).end()
  }
)

export default userRouter
