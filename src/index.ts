'use strict'

import express from 'express'
import path from 'path'
import glob from 'glob'
import middlewares from './middlewares'
import log4js from './logger'

const port = 8080
let logger: any = console;

(function(): void {
  try {
    const app: express.Application = createApp()
    app.use()
    logger = log4js.getLogger('index')
    app.listen(port, () => logger.info(`server started at http://localhost:${port}`))
  } catch (e) {
    logger.error('ERROR: Server failed')
    logger.error(`ERROR: ${e.stack}`)
  }
})()

function setRoutes(app: express.Application): void {
  glob.sync('**/*.routes.*').forEach((routeFile) => {
    const router = require(path.resolve(routeFile))
    app.use('/', router)
  })
}

function createApp(): express.Application {
  log4js.init()
  const app = express()
  middlewares(app)
  setRoutes(app)
  return app
}
