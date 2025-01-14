/* eslint-disable */
/* global db */
// noinspection JSUnresolvedReference,JSIgnoredPromiseFromCall

const UserValidator = {
  $jsonSchema: {
    title: 'User Validation',
    required: ['username', 'passwordHash', 'biography', 'favorites', 'shoppingList', 'isPrivate'],
    properties: {
      username: {
        bsonType: 'string',
        minLength: 3,
        description: '\'username\' must be a string with a minimum length of 3'
      },
      passwordHash: {
        bsonType: 'string',
        description: '\'passwordHash\' must be a string and is required'
      },
      biography: {
        bsonType: 'string',
        description: '\'biography\' must be a string and is required'
      },
      logo: {
        bsonType: 'objectId',
        description: '\'logo\' must be ObjectId of an image file'
      },
      favorites: {
        bsonType: 'array',
        items: {
          bsonType: 'objectId',
          description: '\'favorites\' item must be ObjectId of recipe'
        },
        description: '\'favorites\' must be an array of recipe ObjectIds and is required'
      },
      shoppingList: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['recipeId', 'servings'],
          properties: {
            recipeId: {
              bsonType: 'objectId',
              description: '\'shoppingList.recipeId\' must be ObjectId of recipe'
            },
            servings: {
              bsonType: 'int',
              minimum: 1,
              description: '\'shoppingList.servings\' must be an integer of at least 1'
            }
          }
        },
        description: '\'shoppingList\' must be an array of objects with keys recipeId and servings and is required'
      },
      isPrivate: {
        bsonType: 'bool',
        description: '\'isPrivate\' must be a boolean and is required'
      }
    }
  }
}
/**
 * @type {import("./src/utilities/schemas").UserSchema}
 */
const ExampleUser = {
  _id: ObjectId('67783a1643964ac750c1c18c'),
  username: 'ExampleUser',
  passwordHash: 'ExampleUserPW',
  biography: 'This is a test user which will always have the same id.',
  favorites: [],
  shoppingList: [],
  isPrivate: true
}

const RecipeValidator = {
  $jsonSchema: {
    title: 'Recipe Validation',
    required: ['title', 'description', 'instructions', 'ingredientsList', 'categories', 'isPrivate'],
    properties: {
      title: {
        bsonType: 'string',
        minLength: 3,
        description: '\'title\' must be a string with a minimum length of 3'
      },
      image: {
        bsonType: 'binData',
        description: '\'image\' must be binary data and is required'
      },
      video: {
        bsonType: 'binData',
        description: '\'video\' must be binary data'
      },
      description: {
        bsonType: 'string',
        description: '\'description\' must be a string and is required'
      },
      instructions: {
        bsonType: 'string',
        description: '\'instructions\' must be a string and is required'
      },
      ingredientsList: {
        bsonType: 'array',
        items: { bsonType: 'string' },
        description: '\'ingredientsList\' must be an array of strings and is required'
      },
      categories: {
        bsonType: 'array',
        items: { bsonType: 'string' },
        description: '\'categories\' must be an array of strings and is required'
      },
      isPrivate: {
        bsonType: 'bool',
        description: '\'isPrivate\' must be a boolean and is required'
      }
    }
  }
}
/**
 * @type {import("./src/utilities/schemas").RecipeSchema}
 */
const ExampleRecipe = {
  creatorId: ExampleUser._id,
  title: 'Example Recipe',
  description: 'This is an example recipe.',
  instructions: 'Step 1: Build an API and connect it to a Database.\nStep 2: Build an Android App or a web frontend.\nStep 3: ???\nStep 4: Profit.',
  ingredientsList: ['Node.js', 'MongoDB', 'Android Studio', 'Vue'],
  categories: ['cooking', 'fun', 'long'],
  isPrivate: true
}

db.createUser({
  user: 'cooksta',
  pwd: 'cookstaPW',
  roles: [{ role: 'readWrite', db: 'cooksta' }, { role: 'readWrite', db: 'test' }]
})

db.createCollection(
  'users'
  // { validator: UserValidator }
)
db.users.createIndex({ username: 'text' }, { unique: true })
db.users.insertOne(ExampleUser)

db.createCollection(
  'recipes'
  // { validator: RecipeValidator }
)
db.recipes.insertOne(ExampleRecipe)
