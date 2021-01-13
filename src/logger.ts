'use strict'

import watchr from 'watchr'
import log4js, { Logger, LoggingEvent, levels, Configuration } from 'log4js'
import _ from 'lodash'
import { getRequestContext } from './context_utils'
import { setOptions as setOptionsForExpressLoggerMiddleware, ExpressLoggerProperties } from './middlewares/logger'
import { sep as osSeparator } from 'path'
import { LoggerProperties, HttpLogInterceptors } from './http_client/http_log_interceptors'
export { levels, Level, Logger } from 'log4js'

interface LoggerConfigurations extends Configuration {
  expressMiddlewareOptions?: ExpressLoggerProperties
  httpClient?: LoggerProperties
}
interface ExtendedLoggingEvent extends LoggingEvent{
  requestId?: string
}

const log4jsConfigPath: string = process.env.LOG4JS_CONFIG ?? process.cwd() + '/config/log4js_default.js'
let thisLogger: Logger | Console = console
let log4jsConfig: LoggerConfigurations
let httpLogInterceptors: HttpLogInterceptors
const currentWorkingDirectoryTreeSize: number = process.cwd().split(osSeparator).length

export function init(): void {
  thisLogger.info('Init log4js infrastructure')
  addJsonLayout()
  configureLog4jsForAllApp()
  thisLogger.info('Init log4js infrastructure')
  thisLogger.info('configure watcher for log4js configurations file')
  initWatcherOnConfigurationsFile()
}

function addJsonLayout(): void {
  log4js.addLayout('json', function (config) {
    return function (logEvent: ExtendedLoggingEvent): String {
      const context = getRequestContext() || {}
      logEvent.requestId = context.requestId
      return JSON.stringify(logEvent)
    }
  })
}

function configureLog4jsForAllApp(): void {
  thisLogger.info('Loading log4js configurations')
  log4jsConfig = loadLog4jsConfigurationsFromFile()
  thisLogger.info('shutdown previous loggers (if exists)')
  log4js.shutdown()
  thisLogger.info('log4js configure loggers')
  log4js.configure(log4jsConfig)
  setLoggerForThisModule()
  thisLogger.info('log4js configure express logger middleware')
  setOptionsForExpressLoggerMiddleware(log4jsConfig.expressMiddlewareOptions)
  thisLogger.info('log4js configure httpClient logger interceptors')
  getHttpLogInterceptors().setLogProperties(log4jsConfig.httpClient)
}

function loadLog4jsConfigurationsFromFile(): LoggerConfigurations {
  delete require.cache[log4jsConfigPath]
  return require(log4jsConfigPath)
}

function setLoggerForThisModule(): void {
  thisLogger = log4js.getLogger(convertLoggerNameToBetterName(__filename))
}

function convertLoggerNameToBetterName(loggerName: string): string {
  const loggerNameAsFilePath = removeFileExtensionIfHas(loggerName)
  const pathSplitByOsSeparator: string[] = loggerNameAsFilePath.split(osSeparator)
  if (isFilePathUnderAppLocation(pathSplitByOsSeparator)) {
    if (isIndexFile(pathSplitByOsSeparator)) { return extractRelativePathAndConvertSeparatorToDot(pathSplitByOsSeparator, false) }
    return extractRelativePathAndConvertSeparatorToDot(pathSplitByOsSeparator, true)
  }
  return loggerName

  function removeFileExtensionIfHas (loggerName: string): string {
    const f = loggerName.split('.')
    return f.length > 1 ? f.slice(0, -1).join('.') : loggerName
  }

  function isFilePathUnderAppLocation (splitByOsSeparator: string[]): boolean {
    return splitByOsSeparator.length > currentWorkingDirectoryTreeSize
  }

  function isIndexFile (pathSplitByOsSeparator: string[]): boolean {
    return _.last(pathSplitByOsSeparator) === 'index'
  }

  function extractRelativePathAndConvertSeparatorToDot (pathSplitByOsSeparator: String[], takeFileName: boolean): string {
    const offset: number = takeFileName ? 0 : 1
    return _.slice(pathSplitByOsSeparator, currentWorkingDirectoryTreeSize, pathSplitByOsSeparator.length - offset).join('.')
  }
}

function getHttpLogInterceptors(): HttpLogInterceptors {
  if (!httpLogInterceptors) {
    httpLogInterceptors = require('./http_client/http_log_interceptors')
  }
  return httpLogInterceptors
}

function initWatcherOnConfigurationsFile(): void {
  const stalker = watchr.open(log4jsConfigPath, watcherListener, watcherErrorHandler);

  ['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'uncaughtException'].forEach((eventType) => {
    process.on(eventType, (code) => stalker.close())
  })
}

function watcherListener(changeType: string): void {
  switch (changeType) {
    case 'update':
      try {
        thisLogger.info('on update of log4js config file')
        configureLog4jsForAllApp()
      } catch (e) {
        log4js.getLogger('log4jsLoader').error(e)
      }
      break
  }
}

function watcherErrorHandler(err: Error): void {
  if (err) { console.log('watch failed on', log4jsConfigPath, 'with error', err) }
  console.log('watch successful on', log4jsConfigPath)
}

export function getLogger(loggerName: string): Logger {
  const fixedLoggerName: string = convertLoggerNameToBetterName(loggerName)
  const logger: Logger = log4js.getLogger(fixedLoggerName)
  const tempDebug = logger.debug.bind(logger)

  function newDebugMethod (this: Logger, message: any, ...args: any[]): void {
    if (args && typeof args[0] === 'function' && this.isDebugEnabled()) {
      // @ts-expect-error
      this._log(levels.DEBUG, [args[0]()])
    } else { tempDebug(message, ...args) }
  }

  logger.debug = newDebugMethod.bind(logger)

  return logger
}

export default {
  init,
  getLogger,
  levels,
  createExpressMiddleware: log4js.connectLogger
}
