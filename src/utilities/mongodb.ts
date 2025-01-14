import { Db, GridFSBucket, MongoClient } from 'mongodb'
import sharp from 'sharp'
import { Recipe, User } from './schemas'

export class MongoDBConnector {
  private static client: MongoClient | undefined
  private readonly _db: Db

  constructor() {
    if (!MongoDBConnector.client) {
      MongoDBConnector.client = new MongoClient('mongodb://mongodb:27017', {
        auth: { username: 'cooksta', password: 'cookstaPW' },
        authSource: 'cooksta'
      })
    }
    this._db = MongoDBConnector.client.db('cooksta')
  }

  private async _uploadFile(bucket: GridFSBucket, file: Express.Multer.File, filenamePrefix: 'avatar' | 'image' | 'video', contextId: string) {
    if (!file) { throw new Error('No file provided for upload') }
    if (!file.mimetype.startsWith('image/')) { throw new Error('Invalid image format') }

    const filename = filenamePrefix + '-' + contextId
    const existingFile = await bucket.find({ filename: filename }).next()
    if (existingFile) { await bucket.delete(existingFile._id) }
    const uploadStream = bucket.openUploadStream(
      filename,
      { metadata: { contextId: contextId, contentType: file.mimetype } }
    )
    uploadStream.on('error', () => {
      throw new Error('Failed to upload image')
    })
    uploadStream.end(filenamePrefix === 'avatar' ? await sharp(file.buffer).resize(128, 128).toBuffer() : file.buffer)
  }

  get clientPromise() {
    if (!MongoDBConnector.client) { throw new Error('MongoDBConnector.client is not initialized. Create a new instance first.') }
    return MongoDBConnector.client.connect()
  }

  get db() {
    return this._db
  }

  get users() {
    return this.db.collection<User>('users')
  }

  get recipes() {
    return this.db.collection<Recipe>('recipes')
  }

  get avatarStorage() {
    return new GridFSBucket(this.db, { bucketName: 'avatars' })
  }

  get recipeStorage() {
    return new GridFSBucket(this.db, { bucketName: 'recipes' })
  }

  async uploadUserAvatar(file: Express.Multer.File, contextId: string) {
    return this._uploadFile(this.avatarStorage, file, 'avatar', contextId)
  }

  async uploadRecipeImage(file: Express.Multer.File, contextId: string) {
    return this._uploadFile(this.recipeStorage, file, 'image', contextId)
  }

  async uploadRecipeVideo(file: Express.Multer.File, contextId: string) {
    return this._uploadFile(this.recipeStorage, file, 'video', contextId)
  }
}
