
import { Application, Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import expressRequestMiddleware from './request_context'
import expressLoggerMiddleware from './logger'

export default (app: Application) => {
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())
  app.use(cookieParser())
  app.use(expressRequestMiddleware)
  app.use(expressLoggerMiddleware)
}
