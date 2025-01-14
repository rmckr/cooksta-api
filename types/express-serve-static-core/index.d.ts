/* eslint-disable @typescript-eslint/consistent-type-definitions */
// noinspection JSUnusedGlobalSymbols

import 'express-serve-static-core'
import { Recipe, User } from '../../src/utilities/schemas'

declare module 'express-serve-static-core' {
  interface Request {
    user?: User,
    recipe?: Recipe
  }
}
