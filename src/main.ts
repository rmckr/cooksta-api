import express from 'express'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import { MongoDBConnector } from './utilities/mongodb'
import rootRouter from './routes/root'
import userRouter from './routes/users'
import recipeRouter from './routes/recipes'

// console.log('Happy developing ✨')

const mongodb = new MongoDBConnector()

const app = express()
app.use(session({
  secret: 'cooksta-session-key', // TODO: Get from .env
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ clientPromise: mongodb.clientPromise }),
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}))

app.use('/', rootRouter)
app.use('/api/users', userRouter)
app.use('/api/recipes', recipeRouter)

const server = app.listen(3000, () => {
  console.log('Listening on port 3000.')
})

function shutdown() {
  console.log('Closing server...')
  server.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
