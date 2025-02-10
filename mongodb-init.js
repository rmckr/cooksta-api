/* eslint-disable */
/* global db */
// noinspection JSUnresolvedReference,JSIgnoredPromiseFromCall

const UserValidator = {
  $jsonSchema: {
    title: 'User Validation',
    required: ['username', 'password', 'biography', 'favorites', 'shoppingList', 'isPrivate'],
    properties: {
      username: {
        bsonType: 'string',
        minLength: 3,
        description: '\'username\' must be a string with a minimum length of 3'
      },
      password: {
        bsonType: 'string',
        description: '\'password\' must be a string'
      },
      biography: {
        bsonType: 'string',
        description: '\'biography\' must be a string'
      },
      favorites: {
        bsonType: 'array',
        items: { bsonType: 'objectId' },
        description: '\'favorites\' must be an array of ObjectIds'
      },
      shoppingList: {
        bsonType: 'object',
        patternProperties: {
          "^[a-fA-F0-9]{24}$": {
            "bsonType": "int",
            "minimum": 1
          }
        },
        description: '\'shoppingList\' must be an object with ObjectId keys and int values'
      },
      isPrivate: {
        bsonType: 'bool',
        description: '\'isPrivate\' must be a boolean'
      }
    }
  }
}

const RecipeValidator = {
  $jsonSchema: {
    title: 'Recipe Validation',
    required: ['creatorId', 'title', 'description', 'ingredients', 'portions', 'categories', 'isPrivate'],
    additionalProperties: false,
    properties: {
      creatorId: {
        bsonType: 'objectId',
        description: '\'creatorId\' must be ObjectId of user',
      },
      title: {
        bsonType: 'string',
        minLength: 3,
        maxLength: 100,
        description: '\'title\' must be a string with 3<=length<=100'
      },
      description: {
        bsonType: 'string',
        minLength: 1,
        description: '\'description\' must be a string with minimum length of 1'
      },
      ingredients: {
        bsonType: 'object',
        patternProperties: {
          "^.*$": {
            bsonType: ['int', 'null']
          }
        },
        description: '\'ingredients\' must be an object with string keys and int values'
      },
      portions: {
        bsonType: 'int',
        minimum: 1,
        description: '\'portions\' must be an int with minimum value 1'
      },
      categories: {
        bsonType: 'array',
        items: { bsonType: 'string' },
        description: '\'categories\' must be an array of strings'
      },
      isPrivate: {
        bsonType: 'bool',
        description: '\'isPrivate\' must be a boolean'
      }
    }
  }
}

db.createUser({
  user: 'cooksta',
  pwd: 'cookstaPW',
  roles: [{ role: 'readWrite', db: 'cooksta' }, { role: 'readWrite', db: 'tokens' }, { role: 'readWrite', db: 'gridfs' }]
})

db.createCollection(
  'users'
  // { validator: UserValidator }
)
db.users.createIndex({ username: 'text' }, { unique: true })

db.createCollection(
  'recipes'
  // { validator: RecipeValidator }
)

const gridfsDb = db.getSiblingDB('gridfs')
gridfsDb.users.files.createIndex({ "metadata.contextId": 1 })
gridfsDb.recipes.files.createIndex({ "metadata.contextId": 1 })

const tokensDb = db.getSiblingDB('tokens')
tokensDb.refreshTokens.createIndex(
  { "expiresAt": 1 },
  { expireAfterSeconds: 0 }
)