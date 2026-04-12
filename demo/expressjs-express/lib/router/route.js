let methods

try {
  methods = require('methods')
} catch {
  methods = ['get', 'post', 'put', 'delete']
}

const { init } = require('../middleware/init')

function dispatch(handlers, req, res, done) {
  const stack = [init(), ...handlers]
  let index = 0

  function next(error) {
    if (error || index >= stack.length) {
      done(error)
      return
    }

    const handler = stack[index]
    index += 1

    if (methods.includes((req.method || 'get').toLowerCase()) || handler.length < 4) {
      handler(req, res, next)
      return
    }

    next()
  }

  next()
}

module.exports = { dispatch }
