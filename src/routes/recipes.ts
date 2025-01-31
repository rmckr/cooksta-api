import express from 'express'
import multer from 'multer'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import { RecipeIdParamsSchema, RecipeBodySchema } from '../utilities/schemas.js'
import { DatabaseError, handleRecipeMedia, HTTPError } from '../utilities/utilities.js'
import { validate } from '../middlewares/validate.js'
import { withRecipe } from '../middlewares/withRecipe.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const recipeRouter = express.Router()
recipeRouter.use(express.json())

/**
 * POST /api/recipes
 * Create a new recipe
 * Parameters: none
 * Body: Recipe (excl. id)
 */
recipeRouter.post(
  '/',
  validate({ body: RecipeBodySchema }),
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    const { id, ...body } = req.body

    const files = req.files as unknown as { image?: Express.Multer.File, video?: Express.Multer.File } | undefined
    const imageFile = files?.image
    const videoFile = files?.video

    if (!imageFile) { throw new HTTPError(400, 'Image is required') }

    const result = await mongodb.recipes.insertOne(body)
    if (!result.acknowledged) { throw new DatabaseError('Failed to create recipe') }
    const recipe = { ...body, id: result.insertedId.toHexString() }

    await mongodb.uploadRecipeImage(imageFile, recipe.id)
    if (videoFile) {
      await mongodb.uploadRecipeVideo(videoFile, recipe.id)
    }

    res.status(201).json(recipe)
  }
)

/**
 * GET /api/recipes/<id>
 * Get recipe data by id
 * Parameters: recipeId
 * Body: none
 */
recipeRouter.get(
  '/:recipeId',
  withRecipe,
  validate({ params: RecipeIdParamsSchema }),
  (req, res) => {
    res.status(200).json(req.recipe)
  }
)
/**
 * PUT /api/recipes/<id>
 * Replace an entire recipe
 * Parameters: recipeId
 * Body: Recipe (with or without id, id is ignored)
 */
recipeRouter.put(
  '/:recipeId',
  withRecipe,
  validate({ params: RecipeIdParamsSchema, body: RecipeBodySchema }),
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.recipes.findOneAndReplace({ _id: new ObjectId(req.params.recipeId) }, body, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to replace recipe') }

    const { _id, ...modifiedData } = result
    const recipe = Object.assign(modifiedData, { id: _id.toHexString() })

    await handleRecipeMedia(req)

    res.status(200).setHeader('Location', `/api/recipe/${recipe.id}`).json(recipe.id)
  }
)
/**
 * PATCH /api/recipes/<id>
 * Modifies a recipe partially
 * Parameters: recipeId
 * Body: Recipe (all fields optional, id is ignored)
 */
recipeRouter.patch(
  '/:recipeId',
  withRecipe,
  validate({ params: RecipeIdParamsSchema, body: RecipeBodySchema }),
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.recipes.findOneAndUpdate({ _id: new ObjectId(req.params.recipeId) }, { $set: body }, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to modify recipe') }

    const { _id, ...modifiedData } = result
    const recipe = Object.assign(modifiedData, { id: _id.toHexString() })

    await handleRecipeMedia(req)

    res.status(200).json(recipe)
  }
)
/**
 * DELETE /api/recipes/<id>
 * Deletes a recipe
 * Parameters: recipeId
 * Body: none
 */
recipeRouter.delete(
  '/:recipeId',
  withRecipe,
  validate({ params: RecipeIdParamsSchema }),
  async (req, res) => {
    const result = await mongodb.recipes.deleteOne({ _id: new ObjectId(req.params.recipeId) })
    if (!result.acknowledged) { throw new DatabaseError('Failed to delete recipe') }

    const files = mongodb.recipeStorage.find({ metadata: { contextId: req.params.recipeId } })
    for await (const file of files) { await mongodb.recipeStorage.delete(file._id) }

    res.status(204).end()
  }
)

export default recipeRouter
