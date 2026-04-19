// health owns the red/yellow/green thresholds that decorate the heuristic
// graph. Two scopes, two shapes:
//
//   assessFileHealth(file)    -> {health, healthReason}   (single file)
//   assessSystemHealth(files) -> {health, healthReason}   (whole system)
//
// Both return healthReason:null for green so callers can treat the field as
// "reason to worry" when rendering. Thresholds are deliberately concrete
// numbers rather than contract constants because they are tuning knobs for
// the heuristic only - the architect-produced graph supplies its own health
// values and never hits this module.

export function assessFileHealth(file) {
  if (file.lineCount > 500) {
    return { health: 'red', healthReason: `Large file at ${file.lineCount} lines` }
  }

  if (file.lineCount > 300) {
    return { health: 'yellow', healthReason: `File is ${file.lineCount} lines` }
  }

  if (file.imports.length > 12) {
    return {
      health: 'yellow',
      healthReason: `High dependency count with ${file.imports.length} imports`,
    }
  }

  return { health: 'green', healthReason: null }
}

export function assessSystemHealth(files) {
  const longestFile = files.reduce(
    (largest, file) => (file.lineCount > largest.lineCount ? file : largest),
    files[0],
  )
  const totalImports = files.reduce((total, file) => total + file.imports.length, 0)

  if (longestFile.lineCount > 500) {
    return {
      health: 'red',
      healthReason: `${longestFile.name} is ${longestFile.lineCount} lines`,
    }
  }

  if (files.length > 15) {
    return { health: 'yellow', healthReason: `System contains ${files.length} files` }
  }

  if (totalImports > files.length * 6) {
    return {
      health: 'yellow',
      healthReason: `High coupling with ${totalImports} total imports`,
    }
  }

  return { health: 'green', healthReason: null }
}
