const route = require('./route')
const { Layer } = require('./layer')
const request = require('../request')
const response = require('../response')

function handle(req, res, out) {
  const stack = this.stack || []
  let index = 0

  function next(error) {
    if (error || index >= stack.length) {
      if (typeof out === 'function') {
        out(error)
      }

      return
    }

    const layer = stack[index]
    index += 1

    if (!layer.match(req.path || '/')) {
      next()
      return
    }

    processParams(layer, Object.create(null), req, res, () => {
      route.dispatch(layer.handlers || [], req, res, next)
    })
  }

  if (!stack.length) {
    stack.push(new Layer('/', 'use', [
      (incomingRequest, incomingResponse, done) => {
        incomingRequest.header = request.get
        incomingResponse.send = response.send
        done()
      },
    ]))
  }

  next()
}

function processParams(layer, called, req, res, done) {
  const params = layer.keys || []
  let index = 0

  function iterate(error) {
    if (error || index >= params.length) {
      done(error)
      return
    }

    const key = params[index]
    index += 1
    called[key] = req.params ? req.params[key] : undefined
    iterate()
  }

  iterate()
}

module.exports = { handle, processParams }
