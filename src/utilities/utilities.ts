import { MongoDBConnector } from './mongodb.js'
import { ObjectId, WithId } from 'mongodb'
import { Recipe, RecipeResponseBody, User, UserResponseBody } from './schemas.js'

const mongodb = new MongoDBConnector()
await mongodb.ready

export const categories = ['asian', 'baking', 'dessert', 'drink', 'main', 'italian', 'quick', 'soup', 'vegetarian'] as const

export function normalizeId(recipe: WithId<Recipe>): RecipeResponseBody
export function normalizeId(user: WithId<User>): UserResponseBody
export function normalizeId(recipe: Recipe, id: ObjectId): RecipeResponseBody
export function normalizeId(user: User, id: ObjectId): UserResponseBody
export function normalizeId<T extends WithId<Recipe> | WithId<User> | Recipe | User>(userOrRecipe: T, id?: ObjectId): Omit<T, '_id'> & { id: string } {
  if ('_id' in userOrRecipe) {
    const { _id, ...rest } = userOrRecipe
    return Object.assign(rest, { id: _id.toHexString() })
  } else {
    return Object.assign(userOrRecipe, { id: id!.toHexString() })
  }
}

export async function convertShoppingList(shoppingList: Record<string, number>) {
  const recipeIds = Object.keys(shoppingList).map((id) => new ObjectId(id))

  const recipes = await mongodb.recipes.find({ _id: { $in: recipeIds } }).toArray()
  return recipes.map((recipe) => {
    const { id, title } = normalizeId(recipe)
    return { id, title, portions: shoppingList[id] }
  })
}
