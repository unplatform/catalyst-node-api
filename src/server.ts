import express from 'express'
import cors from 'cors'
import validateEnv from 'valid-env'
// import WebSocket from 'ws'

// import { ChowChow, BaseContext } from '@robb_j/chowchow'
import { LoggerModule } from '@robb_j/chowchow-logger'
import { JsonEnvelopeModule } from '@robb_j/chowchow-json-envelope'
import { RedisModule } from './modules/RedisModule'
import { MonkModule } from './modules/MonkModule'

import * as routes from './routes'
import * as sockets from './sockets'
import { RouteContext, SocketContext } from './types'
import { SocketedChow } from './SocketedChow'

// App entrypoint
;(async () => {
  try {
    // Ensure required environment variables are set or exit(1)
    validateEnv(['WEB_URL', 'REDIS_URL'])

    // Create our custom chowchow app
    // -> not chained becuse #use doesn't preserve the type
    const chow = SocketedChow.create<RouteContext, SocketContext>()

    // Create our chowchow app and apply modules
    chow
      .use(new JsonEnvelopeModule({ handleErrors: true }))
      .use(new LoggerModule({ path: 'logs' }))
      .use(new RedisModule(process.env.REDIS_URL!))
      .use(new MonkModule())

    // Apply express middleware
    chow.applyMiddleware(app => {
      // Setup cors
      let origin = [process.env.WEB_URL!]
      app.use(cors({ origin }))

      // Parse json bodies
      app.use(express.json())
    })

    // Add routes to our endpoints
    chow.applyRoutes((app, r) => {
      app.get('/', r(routes.hello))
      app.get('/cards', r(routes.listCards))
      app.get('/labels', r(routes.listLabels))
      app.get('/content', r(routes.content))
      app.get('/stats', r(routes.stats))
      app.get('/health', r(routes.health))

      if (process.env.NODE_ENV === 'development') {
        app.get('/dev/errors', r(routes.devErrors))
        app.get('/dev/stats', r(routes.devStats))
        app.get('/dev/searches', r(routes.devSearches))
      }
    })

    // Setup the web socket server
    if (process.env.ENABLE_SOCKETS) {
      chow.registerSocket('echo', sockets.echo)
      chow.registerSocket('page_view', sockets.pageView)
      chow.registerSocket('project_action', sockets.projectAction)
      chow.registerSocket('client_error', sockets.clientError)
      chow.registerSocket('search_action', sockets.searchAction)
    }

    // Start the app up
    await chow.start()
    console.log('Listening on :3000')
  } catch (error) {
    console.log('Failed to start:', error.message)
    process.exit(1)
  }
})()
