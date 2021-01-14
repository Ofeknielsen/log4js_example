'use strict'
const { getRequestContext } = require('../context_utils')

/**
 *  DEFAULT_FORMAT =
 "  :remote-addr - -" +
 ' ":method :url HTTP/:http-version"' +
 ' :status :content-length ":referrer"' +
 ' ":user-agent"';
 *   - `:url`
 *   - `:protocol`
 *   - `:hostname`
 *   - `:method`
 *   - `:status`
 *   - `:response-time`
 *   - `:date`
 *   - `:referrer`
 *   - `:http-version`
 *   - `:remote-addr`
 *   - `:user-agent`
 *   - `:content-length`
 *   - `:req[header]` ex: `:req[Accept]`
 *   - `:res[header]` ex: `:res[Content-Length]`
 */
module.exports =
  {
    appenders: {
      consoleAppender: {
        type: "console",
        layout: {
          type: "pattern",
          pattern: "%d | [%x{requestId}] | [%c:%l] [%[%p%]]: %m",
          tokens: {
            "requestId": () => {
              const context = getRequestContext() || {}
              return  context.requestId || 'no-ctx'
            }
          }
        }
      },
    },
    categories: {
      default: {
        appenders: ["consoleAppender"],
        level: "info",
        enableCallStack: false
      },
      "common.repository.superset_api_repository": {
        level: "info",
        appenders: ["consoleAppender"]
      },
      routing: {
        level: "debug",
        appenders: ["consoleAppender"]
      }
    },
    expressMiddlewareOptions: {
      format: '| server[:hostname] | client:[:remote-addr] | :method :url',
      level: 'auto'
    },
    httpClient: {
      request: {
        logIt: false,
        level: 'info',
        method: true,
        url: true,
        body: false,
        headers: 'all'  /* false | 'all' | '<header_name>' | [<header_name>,...] | (req) => headers */
      },
      response: {
        logIt: true,
        level: 'auto', /* when set to auto it determine the level by status code*/
        level2xx: 'info',
        level3xx: 'info',
        level4xx: 'error',
        level5xx: 'error',
        methodAndPath: false,
        statusCode: true,
        body: false, /* true | false | (res) => <bool> */
        headers: 'all', /* false | 'all' | '<header_name>' | [<header_name>,...] | (res) => headers */
      }
    }
  }
