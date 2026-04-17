// Structured logging for command handlers.
// Every log entry has a stable code and optional fields.

export function createLogger({ command, action }) {
  const context = action ? `${command}:${action}` : command

  return {
    info(code, fields = {}) {
      logEntry('info', context, code, fields)
    },

    warn(code, fields = {}) {
      logEntry('warn', context, code, fields)
    },

    error(code, fields = {}) {
      logEntry('error', context, code, fields)
    },
  }
}

function logEntry(level, context, code, fields) {
  const entry = {
    level,
    context,
    code,
    ...fields,
    timestamp: new Date().toISOString(),
  }

  const logFormat = process.env.CLAUDEMAP_LOG_FORMAT || 'human'

  if (logFormat === 'json') {
    console.log(JSON.stringify(entry))
  } else {
    // Human-readable format
    const fieldsSummary = Object.keys(fields).length > 0
      ? ` ${JSON.stringify(fields)}`
      : ''
    console.log(`[${level.toUpperCase()}] ${context} ${code}${fieldsSummary}`)
  }
}
