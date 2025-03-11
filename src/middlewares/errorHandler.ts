import { DatabaseError, HTTPError } from '../utilities/errors.js'
import { ErrorRequestHandler } from 'express'
import { MongoError } from 'mongodb'

export const errorHandler: ErrorRequestHandler = (err, _, res, next) => {
  console.error(err)

  if (res.headersSent) { return next(err) }

  if (err instanceof HTTPError) {
    res.status(err.status).json({ error: err.message })
  } else if (err instanceof DatabaseError) {
    res.status(502).json({ error: err.message })
  } else if (err instanceof MongoError) {
    console.error(err)
    res.status(502).json({ error: 'Unknown database error' })
  } else if (err instanceof Error) {
    res.status(500).json({ error: err.message })
  } else {
    res.status(500).json({ error: 'Internal server error' })
  }
}
