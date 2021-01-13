'use strict'
import { AxiosResponse } from 'axios'
import { getLogger, levels, Level, Logger } from '../logger'
import _ from 'lodash'

const moduleLogger = getLogger(__filename)

type HttpResponse = AxiosResponse
type HttpRequest = any
type HttpMessage = HttpRequest | HttpRequest
type HttpMessageType = 'request' | 'response'
type GetLevelType = (msg: HttpMessage) => string | Level
type LevelProperty = string | Level | GetLevelType
type IsUseBodyType = (msg: HttpMessage) => boolean
type BodyProperty = boolean | IsUseBodyType
type BodyPropertyName = 'body' | 'data'
type HeadersProperty = string | string[] | boolean
type GetHeadersType = (msg: HttpMessage) => HeadersProperty

interface BaseLoggerProperties {
  logIt?: boolean
  level?: LevelProperty
  body?: BodyProperty
  headers?: HeadersProperty | GetHeadersType
}
interface RequestLoggerProperties extends BaseLoggerProperties {
  method?: boolean
  url?: boolean
}
interface ResponseLoggerProperties extends BaseLoggerProperties{
  methodAndPath?: boolean
  statusCode?: boolean
  level2xx?: Level
  level3xx?: Level
  level4xx?: Level
  level5xx?: Level
}
export interface LoggerProperties {
  request?: RequestLoggerProperties
  response?: ResponseLoggerProperties
}

abstract class HttpLogEventData {
  protected httpMsg: HttpMessage
  protected bodyPropertyName: BodyPropertyName

  protected constructor(httpMsg: HttpMessage, bodyPropertyName: BodyPropertyName) {
    this.httpMsg = httpMsg
    this.bodyPropertyName = bodyPropertyName
  }

  getBody(): string {
    return JSON.stringify(this.httpMsg[this.bodyPropertyName])
  }

  abstract getAllowedHeadersToLog(): any
  abstract buildLogMessage(logProperties: ResponseLoggerProperties | RequestLoggerProperties): string

  getHeaders(requireHeadersProp: HeadersProperty | GetHeadersType): string | string[] {
    const headers: any = this.getAllowedHeadersToLog()
    let requireHeaders: HeadersProperty | GetHeadersType = requireHeadersProp
    if (typeof requireHeaders === 'function') { requireHeaders = (requireHeadersProp as GetHeadersType)(this.httpMsg) }
    if (requireHeaders === 'all' || requireHeaders === true) {
      return `headers: ${JSON.stringify(headers)}`
    } else if (typeof requireHeaders === 'string') {
      return `${requireHeaders}: ${headers[requireHeaders]}`
    } else {
      return (requireHeaders as string[]).map(key => `${key}: ${headers[key]}`)
    }
  }

  isAddBody(bodyProp?: BodyProperty): boolean {
    return (bodyProp ?? false) && this.hasBody() && !(typeof bodyProp === 'function' && !bodyProp(this.httpMsg))
  }

  hasBody(): boolean {
    return !!this.httpMsg[this.bodyPropertyName]
  }

  static build(messageType: HttpMessageType, httpMsg: HttpMessage): HttpLogEventData {
    if (messageType === 'request') {
      return new RequestLogEventData(httpMsg)
    } else {
      return new ResponseLogEventData(httpMsg)
    }
  }

  static buildLogMessage(messageType: HttpMessageType, httpMsg: HttpMessage, logProperties: ResponseLoggerProperties | RequestLoggerProperties): string {
    return HttpLogEventData.build(messageType, httpMsg).buildLogMessage(logProperties)
  }
}

class ResponseLogEventData extends HttpLogEventData {
  constructor(res: AxiosResponse) {
    super(res, 'data')
  }

  buildLogMessage(logProperties: BaseLoggerProperties): string {
    const logEventData = []
    let requestString: string | null = null
    if ((logProperties as ResponseLoggerProperties).methodAndPath ?? false) requestString = this.getMethodAndPath()
    if ((logProperties as ResponseLoggerProperties).statusCode ?? false) logEventData.push(this.getStatusCode())
    if (this.isAddBody(logProperties.body)) {
      logEventData.push(this.getBody())
    }
    if (logProperties.headers ?? false) {
      logEventData.push(this.getHeaders(logProperties.headers as HeadersProperty | GetHeadersType))
    }
    return `${requestString ? requestString + ' | ' : ''}Response ${logEventData.join(' | ')}`
  }

  getMethodAndPath(): string {
    return `For ${this.httpMsg.request.method} ${this.httpMsg.request.path}`
  }

  getStatusCode(): string {
    return `code:[${this.httpMsg.status} ${this.httpMsg.statusText}]`
  }

  getAllowedHeadersToLog(): any {
    return this.httpMsg.headers ?? {}
  }
}

class RequestLogEventData extends HttpLogEventData {
  constructor(req: HttpRequest) {
    super(req, 'body')
  }

  buildLogMessage(logProperties: BaseLoggerProperties): string {
    const logEventData = []
    if ((logProperties as RequestLoggerProperties)?.method ?? false) logEventData.push(this.getMethod())
    if ((logProperties as RequestLoggerProperties)?.url ?? false) logEventData.push(this.getUrl())
    if (this.isAddBody(logProperties.body)) {
      logEventData.push(this.getBody())
    }
    if (logProperties.headers ?? false) {
      logEventData.push(this.getHeaders(logProperties.headers as HeadersProperty | GetHeadersType))
    }
    return `Requesting ${logEventData.join(' | ')}`
  }

  getMethod(): string {
    return this.httpMsg.method.toUpperCase()
  }

  getUrl(): string {
    return this.httpMsg.url
  }

  getAllowedHeadersToLog(): any {
    const headers = {
      ...this.httpMsg.headers.common,
      ...this.httpMsg.headers[this.httpMsg.method],
      ...this.httpMsg.headers
    };
    ['common', 'get', 'post', 'head', 'put', 'patch', 'delete', 'authorization'].forEach(header => {
      delete headers[header]
    })
    return headers
  }
}

const defaultLogProperties: LoggerProperties = {
  request: {
    logIt: true,
    level: (req: HttpRequest) => levels.INFO,
    method: true,
    url: true,
    body: false,
    headers: 'all'
  },
  response: {
    logIt: true,
    level: (res: HttpResponse) => res.status < 400 ? levels.INFO : levels.ERROR,
    methodAndPath: true,
    statusCode: true,
    body: false,
    headers: 'all'
  }
}
let _logProperties: LoggerProperties

export function setLogProperties(logProperties?: LoggerProperties): void {
  if (logProperties) {
    _logProperties = createFullLogProperties(logProperties)
  } else {
    _logProperties = defaultLogProperties
  }
}

function createFullLogProperties(logProperties: LoggerProperties): LoggerProperties {
  const requestProps = Object.assign({}, logProperties.request)
  const responseProps = Object.assign({}, logProperties.response)
  if (requestProps.level) {
    requestProps.level = convertLogLevelRequestPropertyToFunction(requestProps.level)
  }
  if (responseProps.level) {
    responseProps.level = convertLogLevelResponsePropertyToFunction(responseProps)
  }
  return _.defaultsDeep({ request: requestProps, response: responseProps }, defaultLogProperties)
}

function convertLogLevelRequestPropertyToFunction(level: LevelProperty): GetLevelType {
  if (typeof level !== 'function') {
    return (req: HttpMessage) => level
  }
  return level
}

function convertLogLevelResponsePropertyToFunction(responseProps: ResponseLoggerProperties): GetLevelType {
  if (typeof responseProps.level !== 'function') {
    if (responseProps.level === 'auto') {
      return convertFromAutoValue(responseProps)
    } else {
      return (req) => responseProps.level as string | Level
    }
  }
  return responseProps.level
}

function convertFromAutoValue(responseProps: ResponseLoggerProperties): GetLevelType {
  const { level2xx = levels.INFO, level3xx = levels.INFO, level4xx = levels.ERROR, level5xx = levels.ERROR } = responseProps
  return (res) => {
    switch (Math.floor(res.status / 100)) {
      case 1:
      case 2:
        return level2xx
      case 3: return level3xx
      case 4: return level4xx
      default: return level5xx
    }
  }
}

export default function build(logger: Logger) {
  return {
    logRequestInterceptor: logInterceptor.bind({ messageType: 'request', logger }),
    logResponseInterceptor: logInterceptor.bind({ messageType: 'response', logger })
  }
}

function logInterceptor(this: {messageType: HttpMessageType, logger: Logger}, httpMsg: HttpMessage) {
  try {
    const logProperties = getHttpLogProperties(this.messageType)
    if (logProperties.logIt) {
      const logMessage = HttpLogEventData.buildLogMessage(this.messageType, httpMsg, logProperties)
      this.logger.log(logProperties.level ? (logProperties.level as GetLevelType)(httpMsg) : levels.INFO, logMessage)
    }
  } catch (e) {
    moduleLogger.error(`Failed to log ${this.messageType}: ${e}`)
  }
  return httpMsg
}

function getHttpLogProperties(msgType: HttpMessageType): BaseLoggerProperties {
  return _logProperties ? _logProperties[msgType] as BaseLoggerProperties : defaultLogProperties[msgType] as BaseLoggerProperties
}

export interface HttpLogInterceptors {
  setLogProperties: (logProperties?: LoggerProperties) => void
}
