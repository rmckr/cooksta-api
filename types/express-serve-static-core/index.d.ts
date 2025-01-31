/* eslint-disable @typescript-eslint/consistent-type-definitions */
// noinspection JSUnusedGlobalSymbols

import 'express-serve-static-core'
import { RecipeResponseBody, UserResponseBody } from '../../src/utilities/schemas.js'
import { UserJWT } from '../../src/utilities/jwt.js'

declare module 'express-serve-static-core' {
  interface Request {
    userToken?: UserJWT | null,
    isValidated?: true,
    user?: UserResponseBody,
    recipe?: RecipeResponseBody
  }
}
