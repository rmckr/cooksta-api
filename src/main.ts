import express from 'express'
import morgan from 'morgan'
import recipeRouter from './routes/recipes.js'
import rootRouter from './routes/root.js'
import userRouter from './routes/users.js'
import { MongoDBConnector } from './utilities/mongodb.js'
import { errorHandler } from './middlewares/errorHandler.js'

// console.log('Happy developing ✨')

const mongodb = new MongoDBConnector()
await mongodb.ready

const app = express()
app.use(morgan('combined'))

app.use('/', rootRouter)
app.use('/api/users', userRouter)
app.use('/api/recipes', recipeRouter)

app.use(errorHandler)

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
