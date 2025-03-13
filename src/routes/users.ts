import bcrypt from 'bcrypt'
import express from 'express'
import fs from 'fs'
import multer from 'multer'
import { DatabaseError } from '../utilities/errors.js'
import { MongoDBConnector } from '../utilities/mongodb.js'
import { ObjectId } from 'mongodb'
import {
  RecipeIdParamsSchema,
  ShoppingListItemBodySchema,
  UserBodySchema,
  UserIdParamsSchema
} from '../utilities/schemas.js'
import { convertShoppingList, normalizeId } from '../utilities/utilities.js'
import { validate } from '../middlewares/validate.js'
import { withUser } from '../middlewares/withUser.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const userRouter = express.Router()
userRouter.use(express.json())

// TODO: Add user search?

/**
 * GET /api/users/<userId>/avatar
 * Gets a user avatar by id.
 * Result: Binary data stream
 */
userRouter.get(
  '/:userId/avatar',
  // TODO: This should be withUser when Glide supports authentication
  validate({ params: UserIdParamsSchema }),
  async (req, res) => {
    const avatarFile = await mongodb.avatarStorage.find({ 'metadata.contextId': req.params.userId }).next()
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
 * PUT /api/users/me/avatar
 * Updates the current users avatar
 */
userRouter.put(
  '/me/avatar',
  withUser,
  upload.single('avatar'),
  async (req, res) => {
    if (req.file) { await mongodb.uploadUserAvatar(req.file, req.user!.id) }
    res.status(204).end()
  }
)

/**
 * GET /api/users/me/shopping-list
 * Get a users shopping list and calculated total ingredients
 * Result: { id: string, title: string, portions: int }[]
 */
userRouter.get(
  '/me/shopping-list',
  withUser,
  async (req, res) => {
    const result = await convertShoppingList(req.user!.shoppingList)

    res.status(200).json(result)
  }
)
/**
 * POST /api/users/me/shopping-list/items
 * Add an item to the shopping list. If the item already exists, sets the new amount.
 * Body: { id: string, portions: int }
 * Result: The new shopping list, see above for type
 */
userRouter.post(
  '/me/shopping-list/items',
  withUser,
  validate({ body: ShoppingListItemBodySchema }),
  async (req, res) => {
    const shoppingList = req.user!.shoppingList
    shoppingList[req.body.id] = req.body.portions

    const updateResult = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.user!.id) }, { $set: { shoppingList: shoppingList } }, { returnDocument: 'after' })
    if (!updateResult) { throw new DatabaseError('Failed to modify shopping list') }

    const result = await convertShoppingList(shoppingList)

    res.status(200).json(result)
  }
)
/**
 * DELETE /api/users/me/shopping-list/items/<recipeId>
 * Delete an item from the shopping list.
 * Result: The new shopping list, see above for type
 */
userRouter.delete(
  '/me/shopping-list/items/:recipeId',
  withUser,
  validate({ params: RecipeIdParamsSchema }),
  async (req, res) => {
    const shoppingList = req.user!.shoppingList
    delete shoppingList[req.params.recipeId]

    const updateResult = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.user!.id) }, { $set: { shoppingList: shoppingList } }, { returnDocument: 'after' })
    if (!updateResult) { throw new DatabaseError('Failed to modify shopping list') }

    const result = await convertShoppingList(shoppingList)

    res.status(200).json(result)
  }
)
/**
 * DELETE /api/users/me/shopping-list/items
 * Delete all items from the shopping list.
 */
userRouter.delete(
  '/me/shopping-list/items',
  withUser,
  async (req, res) => {
    const updateResult = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.user!.id) }, { $set: { shoppingList: {} } }, { returnDocument: 'after' })
    if (!updateResult) { throw new DatabaseError('Failed to modify shopping list') }

    res.status(204).end()
  }
)
/**
 * GET /api/users/me/shopping-list/ingredients
 * Get the calculated total ingredients for the current users shopping list
 * Result: { name: string, amount: float | null }[]
 */
userRouter.get(
  '/me/shopping-list/ingredients',
  withUser,
  async (req, res) => {
    const recipeIds = Object.keys(req.user!.shoppingList).map((id) => new ObjectId(id))

    const recipes = await mongodb.recipes.find({ _id: { $in: recipeIds } }).toArray()

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
    const result = [
      ...Object.entries(ingredientSums).map(([name, amount]) => ({ name: name, amount: amount })),
      ...Array.from(nullIngredientsSet).map((name) => ({ name: name, amount: null }))
    ]

    res.status(200).json(result)
  }
)

/**
 * GET /api/users/<userId>/recipes
 * Get all recipes created by this user
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
 * GET /api/users/<userId>
 * Get user data by id
 * Result: User
 */
userRouter.get(
  '/:userId',
  withUser,
  (req, res) => {
    res.status(200).json(req.user!)
  }
)
/**
 * PUT /api/users/<userId>
 * Replace an entire user
 * Body: User (with or without id, id is ignored)
 * Result: User
 */
userRouter.put(
  '/:userId',
  withUser,
  validate({ body: UserBodySchema }),
  async (req, res) => {
    const { id, ...body } = req.body

    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12)
    }

    const result = await mongodb.users.findOneAndReplace({ _id: new ObjectId(req.user!.id) }, body, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to replace user') }

    const user = normalizeId(result)

    res.status(200).setHeader('Location', `/api/user/${user.id}`).json(user)
  }
)
/**
 * PATCH /api/users/<userId>
 * Modifies a user partially
 * Body: User (all fields optional, id is ignored)
 * Result: User
 */
userRouter.patch(
  '/:userId',
  withUser,
  validate({ body: UserBodySchema.partial() }),
  async (req, res) => {
    const { id, ...body } = req.body

    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12)
    }

    const result = await mongodb.users.findOneAndUpdate({ _id: new ObjectId(req.user!.id) }, { $set: body }, { returnDocument: 'after' })
    if (!result) { throw new DatabaseError('Failed to modify user') }

    const user = normalizeId(result)

    res.status(200).json(user)
  }
)
/**
 * DELETE /api/users/<userId>
 * Deletes a user
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
