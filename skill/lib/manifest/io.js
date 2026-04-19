import fs from 'fs'
import { SCHEMA_NAMES } from '../contracts/schemas/index.js'
import {
  getProjectManifestPath,
  getRuntimeManifestPath,
  readJsonFile,
  writeJsonFileAtomic,
} from '../runtime-paths.js'
import { createDefaultManifest, normalizeManifest } from './normalize.js'

// io owns the three disk-facing helpers:
//
//   readManifest(projectRoot) - reads the on-disk manifest (falling back
//     to createDefaultManifest if absent) and hands it to normalize so
//     callers always see a well-shaped object.
//
//   writeManifest(projectRoot, manifest) - normalizes, atomically writes
//     both the project-local copy (claudemap-maps.json at the repo root)
//     and the runtime copy (under the installed skill) so the app and
//     the commands see a consistent view.
//
//   ensureManifestForSetup(projectRoot) - used by setup: reads the
//     current manifest, and writes it back if there is no manifest file
//     yet. This seeds a new repo with the default root entry.

function manifestExists(projectRoot) {
  return fs.existsSync(getProjectManifestPath(projectRoot))
}

export function readManifest(projectRoot) {
  const manifestPath = getProjectManifestPath(projectRoot)
  const manifest = readJsonFile(manifestPath, createDefaultManifest, {
    schema: SCHEMA_NAMES.MANIFEST,
  })
  return normalizeManifest(manifest)
}

export function writeManifest(projectRoot, manifest) {
  const normalizedManifest = normalizeManifest(manifest)
  writeJsonFileAtomic(getProjectManifestPath(projectRoot), normalizedManifest)
  writeJsonFileAtomic(getRuntimeManifestPath(), normalizedManifest)
  return normalizedManifest
}

export function ensureManifestForSetup(projectRoot) {
  const manifest = readManifest(projectRoot)

  if (!manifestExists(projectRoot)) {
    return writeManifest(projectRoot, manifest)
  }

  return manifest
}
