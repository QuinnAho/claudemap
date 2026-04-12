const { lookup } = require('../view')
const response = require('../response')

function render(viewName, locals = {}, callback) {
  const resolvedView = lookup(viewName, locals.views)
  const html = [
    `<section data-view="${viewName}">`,
    `  <h1>${locals.title || viewName}</h1>`,
    `  <pre>${JSON.stringify(locals, null, 2)}</pre>`,
    '</section>',
  ].join('\n')

  this.viewName = resolvedView || viewName
  response.send.call(this, html)

  if (typeof callback === 'function') {
    callback(null, html)
  }

  return html
}

module.exports = { render }
