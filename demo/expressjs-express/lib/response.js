const { lookup } = require('./view')

let sendModule
let vary

try {
  sendModule = require('send')
} catch {
  sendModule = null
}

try {
  vary = require('vary')
} catch {
  vary = () => undefined
}

function normalizeBody(body) {
  if (body === null || body === undefined) {
    return ''
  }

  if (Buffer.isBuffer(body)) {
    return body
  }

  if (typeof body === 'object') {
    return JSON.stringify(body, null, 2)
  }

  return String(body)
}

function applyCommonHeaders(res) {
  res.headers = res.headers || Object.create(null)
  res.headers['x-powered-by'] = 'claudemap-demo'
  vary(res, 'Accept')
}

function send(body) {
  applyCommonHeaders(this)

  const normalizedBody = normalizeBody(body)
  this.body = normalizedBody
  this.headers['content-length'] = Buffer.byteLength(String(normalizedBody))

  if (!this.headers['content-type']) {
    this.headers['content-type'] =
      typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json' : 'text/html'
  }

  if (typeof this.viewName === 'string') {
    this.headers['x-view-template'] = lookup(this.viewName) || 'inline'
  }

  if (sendModule && this.filePath) {
    this.headers['x-send-target'] = this.filePath
  }

  return this
}

function json(payload) {
  this.headers = this.headers || Object.create(null)
  this.headers['content-type'] = 'application/json; charset=utf-8'
  this.locals = Object.assign({}, this.locals, { serializedAt: new Date().toISOString() })
  return send.call(this, payload)
}

module.exports = { send, json }
