const { defaultConfiguration, lazyrouter } = require('./application')
const router = require('./router')
const request = require('./request')
const response = require('./response')

function createApplication() {
  const app = {
    settings: Object.create(null),
    middlewares: [],
    request: Object.assign({}, request),
    response: Object.assign({}, response),
    router: null,
    locals: Object.create(null),

    use(middleware) {
      this.middlewares.push(middleware)
      return this
    },

    handle(req, res, done) {
      defaultConfiguration.call(this)

      if (!this.router) {
        lazyrouter.call(this)
      }

      return router.handle.call(this.router, req, res, done)
    },
  }

  return app
}

module.exports = { createApplication }
