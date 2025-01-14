import express from 'express'
import multer from 'multer'
import { MongoError, ObjectId } from 'mongodb'
import { MongoDBConnector } from '../utilities/mongodb'
import { defaultErrorResponse, validate } from '../utilities/utilities'
import { RecipeIdParamsSchema, RecipeSchema } from '../utilities/schemas'

const mongodb = new MongoDBConnector()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const recipeRouter = express.Router()
recipeRouter.use(express.json())

recipeRouter.post(
  '/',
  validate({ body: RecipeSchema }),
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  (req, res) => {
    async function insertRecipe() {
      const { id, ...recipeData } = req.body

      const files = req.files as unknown as { image?: Express.Multer.File, video?: Express.Multer.File } | undefined
      const imageFile = files?.image
      const videoFile = files?.video

      if (!imageFile) { throw new Error('Image is required') }

      const recipeResult = await mongodb.recipes.insertOne(recipeData)
      if (!recipeResult.acknowledged) { throw new Error('Failed to insert recipe') }
      const recipeId = recipeResult.insertedId

      await mongodb.uploadRecipeImage(imageFile, recipeId.toHexString())
      if (videoFile) {
        await mongodb.uploadRecipeVideo(videoFile, recipeId.toHexString())
      }

      return { ...recipeData, id: recipeId.toHexString() }
    }

    insertRecipe()
      .then((recipe) => res.status(201).json(recipe))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

recipeRouter.get(
  '/:recipeId',
  validate({ params: RecipeIdParamsSchema }),
  (req, res) => {
    async function fetchRecipe() {
      const recipe = await mongodb.recipes.findOne({ _id: new ObjectId(req.params.recipeId) })
      if (!recipe) { throw new Error('Recipe not found') }
      if (recipe.isPrivate) {
        if (req.session.user?.id !== recipe.creatorId) {
          res.status(403)
          throw new Error('Not authorized')
        }
      }
      return recipe
    }
    fetchRecipe()
      .then((recipe) => res.json(recipe))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

recipeRouter.put(
  '/:recipeId',
  validate({ params: RecipeIdParamsSchema, body: RecipeSchema }),
  upload.fields([{ name: 'image' }, { name: 'video' }]),
  (req, res) => {
    async function updateRecipe() {
      const { id, ...recipeData } = req.body

      const recipe = await mongodb.recipes.findOne({ _id: new ObjectId(req.params.recipeId) })
      if (!recipe) { throw new Error('Recipe not found') }
      if (recipe.isPrivate) {
        if (req.session.user?.id !== recipe.creatorId) {
          res.status(403)
          throw new Error('Not authorized')
        }
      }

      const files = req.files as unknown as { image?: Express.Multer.File, video?: Express.Multer.File } | undefined
      const imageFile = files?.image
      const videoFile = files?.video

      const result = await mongodb.recipes.findOneAndUpdate(
        { _id: new ObjectId(req.params.recipeId) },
        { $set: recipeData },
        { returnDocument: 'after' }
      )
      if (!result) { throw new Error('Failed to update recipe') }

      if (imageFile) {
        await mongodb.uploadRecipeImage(imageFile, result._id.toHexString())
      }
      if (videoFile) {
        await mongodb.uploadRecipeVideo(videoFile, result._id.toHexString())
      }

      return result
    }

    updateRecipe()
      .then((recipe) => res.json(recipe))
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

recipeRouter.delete(
  '/:recipeId',
  validate({ params: RecipeIdParamsSchema }),
  (req, res) => {
    async function deleteRecipe() {
      const recipe = await mongodb.recipes.findOne({ _id: new ObjectId(req.params.recipeId) })
      if (!recipe) { throw new Error('Recipe not found') }
      if (recipe.isPrivate) {
        if (req.session.user?.id !== recipe.creatorId) {
          res.status(403)
          throw new Error('Not authorized')
        }
      }

      const result = await mongodb.recipes.deleteOne({ _id: new ObjectId(req.params.recipeId) })
      if (!result.acknowledged) { throw new Error('Failed to delete recipe') }

      const files = mongodb.recipeStorage.find({ metadata: { contextId: req.params.recipeId } })
      for await (const file of files) {
        await mongodb.recipeStorage.delete(file._id)
      }
    }

    deleteRecipe()
      .then(() => res.status(204).end())
      .catch((error: MongoError | Error) => defaultErrorResponse(res, error))
  }
)

export default recipeRouter
