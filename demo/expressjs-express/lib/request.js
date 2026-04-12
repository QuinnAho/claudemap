let accepts
let typeis

try {
  accepts = require('accepts')
} catch {
  accepts = (req) => ({
    type() {
      return req.headers?.accept || null
    },
  })
}

try {
  typeis = require('type-is')
} catch {
  typeis = (_req, values = []) => values[0] || null
}

function get(field) {
  const headers = this.headers || {}
  const normalizedField = String(field || '').toLowerCase()

  if (normalizedField === 'accept') {
    return accepts({ headers }).type(['html', 'json']) || headers.accept || null
  }

  if (normalizedField === 'content-type') {
    return typeis({ headers }, ['application/json', 'text/html']) || headers['content-type'] || null
  }

  return headers[normalizedField] || null
}

module.exports = { get }
