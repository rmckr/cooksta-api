/* eslint-disable @typescript-eslint/consistent-type-definitions */
// noinspection JSUnusedGlobalSymbols

import 'express-session'
import { Recipe, User } from './utilities/schemas'

declare module 'express-session' {
  export interface SessionData { user: { id: string, username: string } }
}
declare module 'express-serve-static-core' {
  interface Request {
    user?: User,
    recipe?: Recipe
  }
}
