import { useCallback } from 'react'
import { useGraphStore } from '../store/graphStore'
import { selectMapsManifest } from '../store/selectors'
import { buildCreateMapPrompt } from '../lib/assistantPrompts'
import { setActiveMap } from '../lib/mapApi'
import { areStringArraysEqual } from '../lib/graphView'

// useScopedMapAffordance builds the per-node map affordance used by
// SystemNode: if a scoped sub-map already exists for this subtree return
// {kind:'open', onClick} that switches to it, otherwise return
// {kind:'create', prompt} with a brand-aware create-map invocation prefilled with the
// node's scope. Qualification is limited to system nodes whose direct
// children are also systems and number more than two, matching the seed-map
// policy in mapApi.

export function useScopedMapAffordance(nodeById) {
  const mapsManifest = useGraphStore(selectMapsManifest)

  const getAncestorLabels = useCallback(
    (nodeId) => {
      const labels = []
      let currentNode = nodeById.get(nodeId)

      while (currentNode?.parentId) {
        const parentNode = nodeById.get(currentNode.parentId)

        if (!parentNode) {
          break
        }

        labels.unshift(parentNode.data?.label || parentNode.id)
        currentNode = parentNode
      }

      return labels
    },
    [nodeById],
  )

  const switchScopedMap = useCallback(async (mapId) => {
    try {
      await setActiveMap(mapId)
    } catch (error) {
      console.error('Failed to switch map:', error)
    }
  }, [])

  const findScopedMapEntry = useCallback(
    (node) => {
      const manifestMaps = mapsManifest?.maps || []
      const ancestorPath = getAncestorLabels(node.id)

      return (
        manifestMaps.find((mapEntry) => {
          if (mapEntry.id === 'root' || !mapEntry.scope || mapEntry.scope.stale === true) {
            return false
          }

          if (mapEntry.scope.rootSystemId === node.id) {
            return true
          }

          return (
            mapEntry.scope.rootSystemLabel === (node.data?.label || node.id) &&
            areStringArraysEqual(mapEntry.scope.ancestorPath || [], ancestorPath)
          )
        }) || null
      )
    },
    [getAncestorLabels, mapsManifest],
  )

  const buildScopedMapPrompt = useCallback(
    (node) => {
      const scopeJson = JSON.stringify({
        scope: {
          type: 'subsystem',
          rootSystemId: node.id,
          rootSystemLabel: node.data?.label || node.id,
          ancestorPath: getAncestorLabels(node.id),
          filePathHint: node.data?.filePath || null,
        },
        label: node.data?.label || node.id,
        summary: node.data?.summary || null,
      })

      return buildCreateMapPrompt(scopeJson)
    },
    [getAncestorLabels],
  )

  const buildMapAffordance = useCallback(
    (node) => {
      const qualifiesForScopedMap =
        node.type === 'system' &&
        node.data?.childType === 'system' &&
        (node.data?.childCount || 0) > 2

      if (!qualifiesForScopedMap) {
        return null
      }

      const scopedMapEntry = findScopedMapEntry(node)

      if (scopedMapEntry) {
        return {
          kind: 'open',
          onClick: () => switchScopedMap(scopedMapEntry.id),
        }
      }

      return {
        kind: 'create',
        prompt: buildScopedMapPrompt(node),
      }
    },
    [buildScopedMapPrompt, findScopedMapEntry, switchScopedMap],
  )

  return buildMapAffordance
}
