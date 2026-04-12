const router = require('./router')
const { init } = require('./middleware/init')
const { query } = require('./middleware/query')
const request = require('./request')
const response = require('./response')
const { lookup } = require('./view')

function defaultConfiguration() {
  if (this.settings.bootstrapped) {
    return this.settings
  }

  this.settings.bootstrapped = true
  this.settings.caseSensitiveRouting = false
  this.settings.strictRouting = false
  this.locals.lookup = lookup
  this.request = Object.assign({}, request)
  this.response = Object.assign({}, response)

  return this.settings
}

function lazyrouter() {
  if (this.router) {
    return this.router
  }

  this.router = {
    stack: [],
    handle: router.handle,
    processParams: router.processParams,
  }

  this.middlewares = [
    init({ request, response }),
    query({ allowDots: true, allowNested: true }),
  ]

  return this.router
}

module.exports = { defaultConfiguration, lazyrouter }
