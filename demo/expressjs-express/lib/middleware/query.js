let qs

try {
  qs = require('qs')
} catch {
  qs = {
    parse(value = '') {
      return value.split('&').filter(Boolean).reduce((result, pair) => {
        const [key, rawValue = ''] = pair.split('=')
        result[decodeURIComponent(key)] = decodeURIComponent(rawValue)
        return result
      }, {})
    },
  }
}

const request = require('../request')

function query(options = {}) {
  return function queryMiddleware(req, _res, next) {
    const queryString = (req.url || '').split('?')[1] || ''
    req.query = qs.parse(queryString, options)
    req.acceptHeader = request.get.call({ headers: req.headers || {} }, 'accept')

    if (typeof next === 'function') {
      next()
    }
  }
}

module.exports = { query }
