import { Request, Response, NextFunction } from 'express'
import { createRequestContext } from '../context_utils'
import { v4 as uuidV4 } from 'uuid'

export default (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidV4()
  createRequestContext({ requestId })
  next()
}
