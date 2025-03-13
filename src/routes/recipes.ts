import express from 'express'
import multer from 'multer'
import { DatabaseError, HTTPError } from '../utilities/errors.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId, WithId } from 'mongodb'
import { Recipe, RecipeBodySchema, RecipeFeedQuerySchema, SearchQuerySchema } from '../utilities/schemas.js'
import { categories, normalizeId } from '../utilities/utilities.js'
import { validate } from '../middlewares/validate.js'
import { withRecipe } from '../middlewares/withRecipe.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const recipeRouter = express.Router()
recipeRouter.use(express.json())

/**
 * GET /api/recipes/search
 * Find recipes by text
 * Query: ?q=query&limit=10&page=1
 * Result: Recipe[]
 */
recipeRouter.get(
  '/search',
  validate({ query: SearchQuerySchema }),
  async (req, res) => {
    const { q, limit = '10', page = '1' } = req.query

    const limitValue = parseInt(limit, 10)
    const pageValue = parseInt(page, 10)
    const skip = (pageValue - 1) * limitValue

    type Category = typeof categories[number]

    let query
    if (categories.includes(q as Category)) {
      query = { categories: q as Category }
    } else {
      const regex = new RegExp(q, 'i')
      query = {
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } }
        ]
      }
    }

    const recipes = await mongodb.recipes
      .find(query)
      .skip(skip)
      .limit(limitValue)
      .toArray()

    const result = recipes.map((recipe) => normalizeId(recipe))

    res.status(200).json(result)
  }
)

/**
 * GET /api/recipes/<recipeId>/media
 * Get recipe media by recipe id.
 * Result: Media binary data
 */
recipeRouter.get(
  '/:recipeId/media',
  withRecipe,
  async (req, res) => {
    const mediaFile = await mongodb.recipeStorage.find({ 'metadata.contextId': req.recipe!.id }).next()
    if (!mediaFile) { throw new HTTPError(404, 'No media file found') }
    res.setHeader('Content-Type', mediaFile.metadata?.contentType as string)
    const stream = mongodb.recipeStorage.openDownloadStream(mediaFile._id)
      .on('error', () => { throw new DatabaseError('Failed to download file') })
    stream.pipe(res.status(200))
  }
)
/**
 * PUT /api/recipes/<recipeId>/media
 * Update recipe media. Prioritizes video over image, only one file possible.
 */
recipeRouter.put(
  '/:recipeId/media',
  withRecipe,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    const files = req.files as unknown as { image?: Express.Multer.File, video?: Express.Multer.File } | undefined
    const videoFile = files?.video
    const imageFile = files?.image

    if (videoFile) {
      await mongodb.uploadRecipeVideo(videoFile, req.recipe!.id)
    } else if (imageFile) {
      await mongodb.uploadRecipeImage(imageFile, req.recipe!.id)
    } else {
      throw new HTTPError(400, 'A media file is required')
    }

    res.status(204).end()
  }
)

/**
 * GET /api/recipes/feed
 * Get feed of recipes.
 * Query: ?limit=10&page=1&sortBy=date
 * Result: Recipe[]
 */
recipeRouter.get(
  '/feed',
  validate({ query: RecipeFeedQuerySchema }),
  async (req, res) => {
    const { limit = '10', page = '1', sortBy = 'date' } = req.query

    const limitValue = parseInt(limit, 10)
    const pageValue = parseInt(page, 10)
    const skip = (pageValue - 1) * limitValue

    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      date: { createdAt: -1 },
      popularity: { likes: -1, createdAt: -1 }
    }

    const recipes = await mongodb.recipes.aggregate<WithId<Recipe>>([
      { $sort: sortOptions[sortBy] },
      { $skip: skip },
      { $limit: limitValue }
    ]).toArray()

    const feed = recipes.map((recipe) => normalizeId(recipe))

    res.status(200).json(feed)
  }
)

/**
 * POST /api/recipes
 * Create a new recipe
 * Body: Recipe (with or without id, id is ignored)
 * Result: Recipe
 */
recipeRouter.post(
  '/',
  validate({ body: RecipeBodySchema }),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.recipes.insertOne(body)
    if (!result.acknowledged) { throw new DatabaseError('Failed to create recipe') }
    const recipe = normalizeId(body, result.insertedId)

    res.status(201).json(recipe)
  }
)

/**
 * GET /api/recipes/<recipeId>
 * Get recipe data by id
 * Result: Recipe
 */
recipeRouter.get(
  '/:recipeId',
  withRecipe,
  (req, res) => {
    res.status(200).json(req.recipe!)
  }
)
/**
 * PUT /api/recipes/<recipeId>
 * Replace an entire recipe
 * Body: Recipe (with or without id, id is ignored)
 * Result: Recipe
 */
recipeRouter.put(
  '/:recipeId',
  withRecipe,
  validate({ body: RecipeBodySchema }),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.recipes.findOneAndReplace({ _id: new ObjectId(req.recipe!.id) }, body, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to replace recipe') }

    const recipe = normalizeId(result)

    res.status(200).setHeader('Location', `/api/recipe/${recipe.id}`).json(recipe)
  }
)
/**
 * PATCH /api/recipes/<recipeId>
 * Modifies a recipe partially
 * Body: Recipe (all fields optional, id is ignored)
 * Result: Recipe
 */
recipeRouter.patch(
  '/:recipeId',
  withRecipe,
  validate({ body: RecipeBodySchema }),
  async (req, res) => {
    const { id, ...body } = req.body

    const result = await mongodb.recipes.findOneAndUpdate({ _id: new ObjectId(req.params.recipeId) }, { $set: body }, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to modify recipe') }

    const recipe = normalizeId(result)

    res.status(200).json(recipe)
  }
)
/**
 * DELETE /api/recipes/<recipeId>
 * Deletes a recipe
 */
recipeRouter.delete(
  '/:recipeId',
  withRecipe,
  async (req, res) => {
    const result = await mongodb.recipes.deleteOne({ _id: new ObjectId(req.recipe!.id) })
    if (!result.acknowledged) { throw new DatabaseError('Failed to delete recipe') }

    const files = mongodb.recipeStorage.find({ metadata: { contextId: req.recipe!.id } })
    for await (const file of files) { await mongodb.recipeStorage.delete(file._id) }

    res.status(204).end()
  }
)

export default recipeRouter
