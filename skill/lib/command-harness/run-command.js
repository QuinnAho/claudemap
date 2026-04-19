import { resolveProjectRoot } from './project-root.js'
import { parseArgs } from './parse-args.js'
import { withMcp } from './with-mcp.js'
import { createLogger } from './log.js'
import { resolveActiveMap } from '../active-map.js'
import { ClaudeMapError, success, ERROR_CODES } from '../contracts/errors.js'

export async function runCommand(descriptor, argv) {
  try {
    const isDispatcher = Boolean(descriptor.actions)
    let parseResult
    let action = null
    let handler
    let actionSpec

    if (isDispatcher) {
      const actionName = argv.find(arg => !arg.startsWith('--'))

      if (!actionName) {
        printUsage(descriptor)
        return success()
      }

      action = descriptor.actions.find(a => a.name === actionName)

      if (!action) {
        const available = descriptor.actions.map(a => a.name).join(', ')
        throw new ClaudeMapError(ERROR_CODES.UNKNOWN_ACTION, `Unknown action "${actionName}". Available: ${available}`)
      }

      const actionIndex = argv.indexOf(actionName)
      const actionArgv = [...argv.slice(0, actionIndex), ...argv.slice(actionIndex + 1)]

      actionSpec = {
        flags: [...(descriptor.globalFlags || []), ...(action.flags || [])],
        positional: action.positional,
      }

      parseResult = parseArgs(actionArgv, actionSpec)
      handler = action.handler
    } else {
      actionSpec = {
        flags: descriptor.flags || [],
        positional: descriptor.positional,
      }

      parseResult = parseArgs(argv, actionSpec)
      handler = descriptor.handler
    }

    if (parseResult.help) {
      printUsage(descriptor, action)
      return success()
    }

    const args = parseResult.parsed
    const projectRoot = resolveProjectRoot(argv)
    const activeMap = resolveActiveMap(projectRoot)
    const log = createLogger({
      command: descriptor.name,
      action: isDispatcher ? action.name : null,
    })

    const ctx = {
      projectRoot,
      activeMap,
      log,
    }

    let mcpMode = null
    let requireStdio = false

    if (descriptor.withMcp || (action && action.withMcp)) {
      const withMcpConfig = descriptor.withMcp || action.withMcp

      if (typeof withMcpConfig === 'boolean') {
        mcpMode = 'auto'
      } else {
        mcpMode = withMcpConfig.mode || 'auto'
        requireStdio = withMcpConfig.requireStdio || false
      }

      if (args.stdioMcp) {
        mcpMode = 'stdio'
      }
    }

    const result = await withMcp(
      { mode: mcpMode, requireStdio, activeMap, log },
      async (mcpClient) => {
        ctx.mcp = mcpClient
        return handler({ ctx, args })
      },
    )

    if (result && result.ok === false) {
      console.error(`${result.code}: ${result.message}`)
      if (result.hint) {
        console.error(result.hint)
      }
      process.exitCode = 1
      return result
    }

    log.info(ERROR_CODES.COMMAND_OK, result?.data || {})
    return result || success()
  } catch (error) {
    if (error instanceof ClaudeMapError) {
      console.error(`${error.code}: ${error.message}`)
      if (error.hint) {
        console.error(error.hint)
      }
    } else {
      console.error(error.message || error)
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack)
      }
    }

    process.exitCode = 1
    throw error
  }
}

function printUsage(descriptor, action = null) {
  if (action) {
    console.log(`${descriptor.name} ${action.name} - ${action.summary || ''}`)
    console.log('')

    const positionalHint = action.positional?.name
      ? `[${action.positional.name}]`
      : ''
    console.log(`Usage: ${descriptor.name} ${action.name} ${positionalHint}`)

    if (action.flags && action.flags.length > 0) {
      console.log('')
      console.log('Flags:')
      for (const flag of action.flags) {
        const typeHint = flag.type === 'boolean' ? '' : ` <${flag.type || 'value'}>`
        console.log(`  --${flag.name}${typeHint}${flag.description ? ': ' + flag.description : ''}`)
      }
    }
  } else if (descriptor.actions) {
    console.log(`${descriptor.name} - ${descriptor.summary}`)
    console.log('')
    console.log('Actions:')
    for (const a of descriptor.actions) {
      console.log(`  ${a.name} - ${a.summary || ''}`)
    }
    console.log('')
    console.log('Use --help with an action for detailed usage.')
  } else {
    console.log(`${descriptor.name} - ${descriptor.summary}`)
    console.log('')

    const positionalHint = descriptor.positional?.name
      ? `[${descriptor.positional.name}]`
      : ''
    console.log(`Usage: ${descriptor.name} ${positionalHint}`)

    if (descriptor.flags && descriptor.flags.length > 0) {
      console.log('')
      console.log('Flags:')
      for (const flag of descriptor.flags) {
        const typeHint = flag.type === 'boolean' ? '' : ` <${flag.type || 'value'}>`
        console.log(`  --${flag.name}${typeHint}${flag.description ? ': ' + flag.description : ''}`)
      }
    }
  }
}

export function exitOnError(error) {
  console.error(error.message || error)
  process.exit(1)
}
