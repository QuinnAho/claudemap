const request = require('../request')
const response = require('../response')

function init(seed = {}) {
  return function initMiddleware(req, res, next) {
    req.locals = Object.assign({}, seed.request || request)
    req.params = req.params || Object.create(null)
    req.id = req.id || `req-${Date.now()}`

    res.locals = Object.assign({}, seed.response || response)
    res.headers = res.headers || Object.create(null)
    res.statusCode = res.statusCode || 200

    if (typeof next === 'function') {
      next()
    }
  }
}

module.exports = { init }
