let pathToRegexp

try {
  pathToRegexp = require('path-to-regexp')
} catch {
  pathToRegexp = (pattern) => ({
    regexp: new RegExp(`^${pattern === '/' ? '' : pattern}`),
    keys: [],
  })
}

class Layer {
  constructor(path, method, handlers) {
    this.path = path
    this.method = method
    this.handlers = Array.isArray(handlers) ? handlers : [handlers]
    this.keys = []
    this.matcher = pathToRegexp(path)
  }

  match(url) {
    if (typeof this.matcher === 'function') {
      return Boolean(this.matcher(url))
    }

    const regexp = this.matcher.regexp || this.matcher
    return regexp.test(url)
  }
}

module.exports = { Layer }
