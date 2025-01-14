import fs from 'fs'
import express from 'express'
import multer from 'multer'
import { MongoError, ObjectId } from 'mongodb'
import { MongoDBConnector } from '../utilities/mongodb'
import { defaultErrorResponse, validate, withOwnerUser, withUser } from '../utilities/utilities'
import { UserIdParamsSchema, UserSchema } from '../utilities/schemas'

const mongodb = new MongoDBConnector()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const userRouter = express.Router()
userRouter.use(express.json())

const defaultAvatar = mongodb.avatarStorage.find({ filename: 'default' }).next()
  .then((file) => {
    if (file) { return file }
    const uploadStream = mongodb.avatarStorage
      .openUploadStream('default', { metadata: { contentType: 'image/png' } })
      .on('error', () => { throw new Error('Failed to upload default image') })
    return new Promise<void>((resolve, reject) => {
      fs.createReadStream('./img/default.png').pipe(uploadStream).on('error', reject).on('finish', () => resolve())
    }).then(async () => (await mongodb.avatarStorage.find({ filename: 'default' }).next())!)
  })


// TODO: Improve search with query parameters
userRouter.get(
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
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)
userRouter.get(
  '/:userId/avatar',
  validate({ params: UserIdParamsSchema }),
  (req, res) => {
    async function getAvatarStream() {
      let avatarFile = await mongodb.avatarStorage.find({ metadata: { contextId: req.params.userId } }).next()
      if (!avatarFile) { avatarFile = await defaultAvatar }
      res.setHeader('Content-Type', avatarFile.metadata?.contentType as string)
      return mongodb.avatarStorage.openDownloadStream(avatarFile._id).on('error', () => { throw new Error('Failed to download image') })
    }
    getAvatarStream()
      .then((stream) => stream.pipe(res.status(200)))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)
userRouter.get(
  '/:userId',
  validate({ params: UserIdParamsSchema }),
  withUser(),
  (req, res) => {
    if (req.user) {
      res.status(200).json(req.user)
    } else {
      defaultErrorResponse(res)
    }
  }
)
userRouter.put(
  '/:userId',
  validate({ params: UserIdParamsSchema, body: UserSchema }),
  withOwnerUser(),
  upload.single('avatar'),
  (req, res) => {
    async function updateUser() {
      const { id, ...body } = {
        ...req.body,
        favorites: req.body.favorites ?? [],
        shoppingList: req.body.shoppingList ?? [],
        isPrivate: req.body.isPrivate ?? false
      }
      const result = await mongodb.users.findOneAndReplace({ _id: new ObjectId(req.params.userId) }, body, { returnDocument: 'after' })
      if (!result) { throw new Error('Replace was not acknowledged') }
      const { _id, ...user } = result

      if (req.file) {
        await mongodb.uploadUserAvatar(req.file, _id.toHexString())
      }

      return Object.assign(user, { id: _id.toHexString() })
    }
    updateUser()
      .then((user) => res.status(200).setHeader('Location', `/api/user/${user.id}`).json(user.id))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)
userRouter.patch(
  '/:userId',
  validate({ params: UserIdParamsSchema, body: UserSchema.partial() }),
  withOwnerUser(),
  upload.single('avatar'),
  (req, res) => {
    async function modifyUser() {
      const { id, ...body } = req.body
      const result = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.params.userId) }, { $set: body }, { returnDocument: 'after' })
      if (!result) { throw new Error('Update was not acknowledged') }
      const { _id, ...user } = result

      if (req.file) {
        await mongodb.uploadUserAvatar(req.file, _id.toHexString())
      }

      return Object.assign(user, { id: _id.toHexString() })
    }
    modifyUser()
      .then((user) => res.status(200).json(user))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)
userRouter.delete(
  '/:userId',
  validate({ params: UserIdParamsSchema }),
  withOwnerUser(),
  (req, res) => {
    async function deleteUser() {
      const result = await mongodb.users.deleteOne({ _id: new ObjectId(req.params.userId) })
      if (!result.acknowledged) { throw new Error('Delete was not acknowledged') }

      const avatarFile = await mongodb.avatarStorage.find({ metadata: { userId: req.params.userId } }).next()
      if (avatarFile) { await mongodb.avatarStorage.delete(avatarFile._id) }
    }
    deleteUser()
      .then(() => res.status(204).end())
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

export default userRouter
