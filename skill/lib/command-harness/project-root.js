import path from 'path'

export function resolveProjectRoot(argv, positionalName = null) {
  const optionsWithValues = new Set([
    '--enrichment-file',
    '--scope-json',
    '--instructions',
    '--zoom',
    '--explain',
    '--title',
    '--step',
    '--mode',
  ])

  const projectRootArg = argv.find((argument, index) => {
    if (argument.startsWith('--')) {
      return false
    }

    const previousArgument = argv[index - 1]
    return !optionsWithValues.has(previousArgument)
  })

  return path.resolve(
    projectRootArg ||
    process.env.CLAUDEMAP_PROJECT_ROOT ||
    process.env.INIT_CWD ||
    process.cwd(),
  )
}
