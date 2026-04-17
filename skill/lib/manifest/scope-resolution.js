import {
  arraysEqual,
  collectAncestorLabels,
  computeScopeFingerprint,
  normalizePathValue,
  normalizeText,
} from './fingerprint.js'

// scope-resolution owns the "find the right system node for this stored
// scope" policy. Scoped maps persist a scope descriptor that pins them
// to a system, but enrichment runs can reshuffle ids and sometimes even
// rename or move systems, so we try progressively looser strategies:
//
//   1. id               - exact id match
//   2. path             - unique node with the same filePath
//   3. fingerprint      - unique node whose computed fingerprint matches
//   4. ancestor-label   - unique node whose label + ancestor chain match
//   5. label            - unique node with a matching label anywhere
//
// Plus the one observability sentinel:
//
//   ancestor-label-ambiguous - multiple nodes matched on label +
//     ancestor chain. The first candidate is returned, but callers can
//     see that the match was not unique by checking the strategy tag.
//
// Return shape:
//
//   { system: <full node>, strategy: <tag> }   on match
//   null                                        on miss
//
// The full node is returned (not just the id) so callers can use node
// metadata (label, filePath, children) without a second nodes.find.
// Legacy callers that only need the id just read resolved.system.id.

export function resolveScopeAgainstGraph(scope, rootGraph) {
  const systemNodes = (rootGraph?.nodes || []).filter((node) => node.type === 'system')

  if (!scope || systemNodes.length === 0) {
    return null
  }

  if (scope.rootSystemId) {
    const directMatch = systemNodes.find((node) => node.id === scope.rootSystemId)

    if (directMatch) {
      return { system: directMatch, strategy: 'id' }
    }
  }

  if (scope.filePathHint) {
    const matchingSystems = systemNodes.filter(
      (node) => normalizePathValue(node.filePath) === normalizePathValue(scope.filePathHint),
    )

    if (matchingSystems.length === 1) {
      return { system: matchingSystems[0], strategy: 'path' }
    }
  }

  if (scope.fingerprint) {
    const matchingSystems = systemNodes.filter(
      (node) => computeScopeFingerprint(rootGraph, node.id) === scope.fingerprint,
    )

    if (matchingSystems.length === 1) {
      return { system: matchingSystems[0], strategy: 'fingerprint' }
    }
  }

  if (scope.rootSystemLabel) {
    const expectedLabel = normalizeText(scope.rootSystemLabel)
    const expectedAncestors = (scope.ancestorPath || []).map(normalizeText)
    const matchingSystems = systemNodes.filter((node) => {
      if (normalizeText(node.label || node.id) !== expectedLabel) {
        return false
      }

      return arraysEqual(
        collectAncestorLabels(rootGraph, node.id).map(normalizeText),
        expectedAncestors,
      )
    })

    if (matchingSystems.length === 1) {
      return { system: matchingSystems[0], strategy: 'ancestor-label' }
    }

    if (matchingSystems.length > 1) {
      return { system: matchingSystems[0], strategy: 'ancestor-label-ambiguous' }
    }
  }

  if (scope.rootSystemLabel) {
    const matchingSystems = systemNodes.filter(
      (node) => normalizeText(node.label || node.id) === normalizeText(scope.rootSystemLabel),
    )

    if (matchingSystems.length === 1) {
      return { system: matchingSystems[0], strategy: 'label' }
    }
  }

  return null
}
