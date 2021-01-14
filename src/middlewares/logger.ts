'use strict'
import { Request, Response, NextFunction } from 'express'
import { Format } from 'log4js'
import {createExpressMiddleware, getLogger} from '../logger'

type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void

let loggerMiddleware: ExpressMiddleware

export interface ExpressLoggerProperties { format?: Format, level?: string, nolog?: any }

export function setOptions(options?: ExpressLoggerProperties): void {
  const { getLogger, createExpressMiddleware } = require('../logger')
  loggerMiddleware = createExpressMiddleware(getLogger('express'), options)
}

export default (req: Request, res: Response, next: NextFunction): void => {
  if (!(loggerMiddleware ?? false)) {
    setOptions({ level: 'auto', nolog: 'service/version|service/health' })
  }
  loggerMiddleware(req, res, next)
}
