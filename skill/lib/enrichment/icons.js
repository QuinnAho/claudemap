// icons owns the "what icon best represents this system" heuristic used by
// the heuristic graph builder. The regex ladder runs against the system key
// and concatenated file paths so a "routes/api" directory picks up both the
// route and api keywords. The order matters: more specific domains come
// first so e.g. an auth-shaped middleware file still gets the shield icon
// instead of the layers icon.
//
// The icon strings are the same tokens the app-side icon renderer expects.
// Keep this list in sync with whichever contract eventually owns them.

export function iconForSystem(key, files) {
  const value = `${key} ${files.map((file) => file.relativePath).join(' ')}`.toLowerCase()

  if (/(auth|login|token|session|acl|permission|role)/.test(value)) return 'shield'
  if (/(db|database|model|schema|query|migration|store|sql|mongo|postgres)/.test(value)) return 'database'
  if (/(route|router|path|endpoint)/.test(value)) return 'route'
  if (/(api|client|http|web|network)/.test(value)) return 'globe'
  if (/(middleware|hook|pipeline)/.test(value)) return 'layers'
  if (/(plugin|extension|adapter)/.test(value)) return 'puzzle'
  if (/(mail|email|message)/.test(value)) return 'envelope'
  if (/(time|date|schedule|clock|cron)/.test(value)) return 'clock'
  if (/(config|settings|setup|build)/.test(value)) return 'gear'
  if (/(server|app|core|runtime)/.test(value)) return 'server'
  return 'code'
}
