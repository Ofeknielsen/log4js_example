
import asyncHooks from 'async_hooks'
// require = require('esm')(module);

export interface RequestContext {
  requestId: string
}

const store = new Map()

const asyncHook = asyncHooks.createHook({
  init: (asyncId, _, triggerAsyncId) => {
    if (store.has(triggerAsyncId)) {
      store.set(asyncId, store.get(triggerAsyncId))
    }
  },
  destroy: (asyncId) => {
    if (store.has(asyncId)) {
      store.delete(asyncId)
    }
  }
})

asyncHook.enable()

export function createRequestContext(requestContext: RequestContext): RequestContext {
  store.set(asyncHooks.executionAsyncId(), requestContext)
  return requestContext
}

export const getRequestContext: () => RequestContext = () => {
  return store.get(asyncHooks.executionAsyncId())
}
