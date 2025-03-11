import ms from 'ms'
import sharp from 'sharp'
import { Db, GridFSBucket, MongoClient } from 'mongodb'
import { HTTPError } from './errors.js'
import { REFRESH_TOKEN_EXPIRATION } from './jwt.js'
import { Recipe, User } from './schemas.js'

const production = process.argv[2] !== '--dev'

export class MongoDBConnector {
  private static client?: MongoClient
  private static connectionPromise?: Promise<void>

  private _cooksta?: Db
  private _tokens?: Db
  private _gridfs?: Db

  constructor() {
    if (!MongoDBConnector.client) {
      MongoDBConnector.client = new MongoClient(production ? 'mongodb://mongodb:27017' : 'mongodb://localhost:1234', {
        auth: { username: 'cooksta', password: 'cookstaPW' },
        authSource: 'cooksta'
      })
      MongoDBConnector.connectionPromise = MongoDBConnector.client
        .connect()
        .then(() => {
          console.log('Successfully connected to MongoDB.')
        })
        .catch((err) => {
          console.error('Failed to connect to MongoDB:', err)
        })
    }
  }

  get ready() {
    return (async () => {
      if (!MongoDBConnector.connectionPromise) { throw new Error('Database not initialized.') }
      await MongoDBConnector.connectionPromise
      if (!this._cooksta || !this._tokens || !this._gridfs) {
        this._cooksta = MongoDBConnector.client!.db('cooksta')
        this._tokens = MongoDBConnector.client!.db('tokens')
        this._gridfs = MongoDBConnector.client!.db('gridfs')

        // await this.refreshTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      }
    })()
  }

  private async _uploadFile(bucket: GridFSBucket, file: Express.Multer.File, filenamePrefix: 'avatar' | 'image' | 'video', contextId: string) {
    if (!file) { throw new Error('No file provided for upload') }
    if (!(file.mimetype.includes('image/') || file.mimetype.includes('video/'))) {
      throw new HTTPError(400, 'Invalid file type')
    }

    const filename = filenamePrefix + '-' + contextId
    const existingFile = await bucket.find({ filename: filename }).next()
    if (existingFile) { await bucket.delete(existingFile._id) }
    const uploadStream = bucket.openUploadStream(
      filename,
      { metadata: { contextId: contextId, contentType: file.mimetype } }
    )
    uploadStream.on('error', () => {
      throw new Error('Failed to upload file')
    })
    const buffer = filenamePrefix === 'avatar' ? await sharp(file.buffer).resize(128, 128).toBuffer() : file.buffer
    uploadStream.end(buffer)
  }

  get users() {
    if (!this._cooksta) { throw new Error('Database not initialized.') }
    return this._cooksta.collection<User>('users')
  }

  get recipes() {
    if (!this._cooksta) { throw new Error('Database not initialized.') }
    return this._cooksta.collection<Recipe>('recipes')
  }

  get refreshTokens() {
    if (!this._tokens) { throw new Error('Database not initialized.') }
    return this._tokens.collection<{ token: string, userId: string, expiresAt: Date }>('refreshTokens')
  }

  get avatarStorage() {
    if (!this._gridfs) { throw new Error('Database not initialized.') }
    return new GridFSBucket(this._gridfs, { bucketName: 'users' })
  }

  get recipeStorage() {
    if (!this._gridfs) { throw new Error('Database not initialized.') }
    return new GridFSBucket(this._gridfs, { bucketName: 'recipes' })
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

  async storeRefreshToken(refreshToken: string, userId: string) {
    const expiresAt = new Date(Date.now() + ms(REFRESH_TOKEN_EXPIRATION))
    const tokenData = {
      token: refreshToken,
      userId: userId,
      expiresAt: expiresAt
    }
    await this.refreshTokens.insertOne(tokenData)
  }
}
