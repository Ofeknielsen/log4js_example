'use strict'
import express, {Request, Response} from 'express'
import HttpStatus from 'http-status'
import httpClient from './http_client'
import {getLogger} from './logger'
import httpStatus from "http-status";
import exp from "constants";

const logger = getLogger(__filename)
const router = express.Router()

logger.debug('Registering the route for GET /service/health')
router.get('/service/health', (req, res) => {
    res.sendStatus(HttpStatus.OK)
})

logger.debug('Registering the route for GET /service/version')
router.get('/service/version', (req, res) => {
    const version = require('../package.json').version
    return res.status(HttpStatus.OK).json({ v: version || 'n/a' })
})

logger.debug('Registering the route for GET /demo')
router.get('/demo', handle)

logger.debug('Registering the route for POST /demo')
router.post('/demo', handle)

async function handle(req: Request, res: Response) {
    if (req.query.http_client) {
        // @ts-ignore
        try {
            const clientResponse = await httpClient.get( '127.0.0.1:8080'+req.path)
            res.status(clientResponse.status).send(clientResponse.data)
        } catch (ex) {
            res.status(500).send(ex).end()
        }
    } else {
        res.status(getReturnStatus(req))
        if (!(req.query.cookie !== undefined && req.query.cookie === 'false')) {
            res.cookie("demo", "demoval")
        }
        res.send(getBodyToReturn(req))
            .end()
    }
}


function getReturnStatus(req: Request): number {
    const code = parseInt(req.query?.code as string)
    return isNaN(code) ? 200 : code
}

function getBodyToReturn(req: Request): any {
    if (req.method === 'GET') {
        return null
    } else {
        return req.body
    }
}

module.exports = router
