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

/**
 * GET /users/<id>/shopping-list
 * Get a users shopping list and calculated total ingredients
 * Result: {
 *   shoppingList: { id: string, title: string, portions: int }[]
 *   ingredients: { name: string, amount: float | null }[]
 * }
 */
userRouter.get(
  '/:userId/shopping-list',
  withUser,
  async (req, res) => {
    const recipeIds = Object.keys(req.user!.shoppingList).map((id) => new ObjectId(id))

    const recipes = await mongodb.recipes.find({ _id: { $in: recipeIds } }).toArray()

    const recipesResult = recipes.map((recipe) => {
      const { id, title } = normalizeId(recipe)
      return { id, title, portions: req.user!.shoppingList[recipe._id.toHexString()] }
    })
    const allIngredients = recipes.map((recipe) => Object.fromEntries(
      Object.entries(recipe.ingredients)
        .map(([name, amount]) => {
          const portionsNeeded = req.user!.shoppingList[recipe._id.toHexString()]
          return [name, amount ? amount / recipe.portions * portionsNeeded : null]
        })
    ))
    const { ingredientSums, nullIngredientsSet } = allIngredients.reduce((acc, ingredients) => {
      Object.entries(ingredients).forEach(([key, value]) => {
        if (value === null) {
          acc.nullIngredientsSet.add(key)
        } else {
          acc.ingredientSums[key] = (acc.ingredientSums[key] || 0) + value
        }
      })
      return acc
    }, { ingredientSums: {} as Record<string, number>, nullIngredientsSet: new Set<string>() })
    const ingredientsResult = [
      ...Object.entries(ingredientSums).map(([name, amount]) => ({ name: name, amount: amount })),
      ...Array.from(nullIngredientsSet).map((name) => ({ name: name, amount: null }))
    ]

    const result = { shoppingList: recipesResult, ingredients: ingredientsResult }

    res.status(200).json(result)
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
