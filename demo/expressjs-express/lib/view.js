const fs = require('fs')
const path = require('path')

function lookup(viewName, rootDirectory = path.join(process.cwd(), 'views')) {
  const normalizedName = String(viewName || '').replace(/^\//, '')
  const candidates = [
    path.join(rootDirectory, `${normalizedName}.html`),
    path.join(rootDirectory, `${normalizedName}.pug`),
    path.join(rootDirectory, normalizedName, 'index.html'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

module.exports = { lookup }
