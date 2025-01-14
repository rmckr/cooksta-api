/* eslint-disable @typescript-eslint/consistent-type-definitions */
// noinspection JSUnusedGlobalSymbols

import 'express-session'

declare module 'express-session' {
  export interface SessionData { user: { id: string, username: string } }
}
