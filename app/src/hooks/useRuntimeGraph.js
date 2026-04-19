import { useCallback, useEffect, useRef } from 'react'
import { GRAPH_SOURCES } from '../contracts/graph-sources'
import { getBrand } from '../lib/brand'
import { getClientActiveMapOverride } from '../lib/mapApi'
import {
  createDefaultRuntimeEnvelope,
  fetchGraphAsset,
  fetchMapsManifest,
  fetchRuntimeEnvelopeAsset,
  getActiveMapEntry,
  getManifestSignature,
  getRuntimeSignature,
  isGraphPayload,
  loadSeedGraph,
} from '../lib/runtimeAssets'
import { useGraphStore } from '../store/graphStore'
import {
  selectResetForMapChange,
  selectSetGraph,
  selectSetGraphLoaded,
  selectSetMapsManifest,
  selectSetMeta,
  selectSetRuntimeControls,
} from '../store/selectors'
import { transformToReactFlow } from '../lib/graphTransform'

// useRuntimeGraph owns the loader pipeline that walks manifest -> active map ->
// runtime envelope -> graph asset and writes the result into the graph and
// runtime slices. It exposes a stable loadRuntimeData callback. It does NOT
// manage the polling interval; useRuntimePolling drives that loop and just
// calls loadRuntimeData. It does NOT return graphLoaded; that lives in the
// store now so any consumer can subscribe via selectGraphLoaded.

export function useRuntimeGraph() {
  const setGraph = useGraphStore(selectSetGraph)
  const setMeta = useGraphStore(selectSetMeta)
  const setMapsManifest = useGraphStore(selectSetMapsManifest)
  const setRuntimeControls = useGraphStore(selectSetRuntimeControls)
  const resetForMapChange = useGraphStore(selectResetForMapChange)
  const setGraphLoaded = useGraphStore(selectSetGraphLoaded)

  const isMountedRef = useRef(true)
  const latestGraphRevisionRef = useRef(null)
  const latestRuntimeSignatureRef = useRef('')
  const latestManifestSignatureRef = useRef('')
  const latestActiveMapIdRef = useRef('')

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadRuntimeData = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }

    const applyGraphData = (graphData) => {
      if (!isMountedRef.current || !isGraphPayload(graphData)) {
        return
      }

      const { nodes, edges } = transformToReactFlow(graphData)

      setGraph(nodes, edges)
      setMeta({
        repoName: graphData.meta?.repoName || 'claudemap',
        creditLabel: graphData.meta?.creditLabel || `${getBrand().displayName} graph`,
        source: graphData.meta?.source || GRAPH_SOURCES.SEED,
        lastSyncedAt: Date.now(),
      })
      setGraphLoaded(true)
    }

    const applyRuntimeEnvelope = (runtimeEnvelope) => {
      const normalizedEnvelope = runtimeEnvelope || createDefaultRuntimeEnvelope()
      const runtimeSignature = getRuntimeSignature(normalizedEnvelope)

      if (runtimeSignature !== latestRuntimeSignatureRef.current) {
        latestRuntimeSignatureRef.current = runtimeSignature
        setRuntimeControls(normalizedEnvelope.runtime)
        setMeta({ lastSyncedAt: Date.now() })
      }
    }

    const manifest = await fetchMapsManifest()

    // On static hosts (e.g. the published /docs demo) the Vite API that
    // persists activeMapId isn't reachable, so MapSelector writes the user's
    // choice into a client-side override via setActiveMap. Apply that override
    // here so downstream consumers (store.activeMapId, getActiveMapEntry) see
    // the selected submap as if it had come from the manifest.
    const clientOverrideId = getClientActiveMapOverride()
    if (
      clientOverrideId &&
      manifest?.maps?.some((entry) => entry.id === clientOverrideId) &&
      manifest.activeMapId !== clientOverrideId
    ) {
      manifest.activeMapId = clientOverrideId
    }

    const activeMapEntry = getActiveMapEntry(manifest)

    if (!isMountedRef.current || !activeMapEntry) {
      return
    }

    const manifestSignature = getManifestSignature(manifest)

    if (manifestSignature !== latestManifestSignatureRef.current) {
      latestManifestSignatureRef.current = manifestSignature
      setMapsManifest(manifest)
    }

    const activeMapChanged = activeMapEntry.id !== latestActiveMapIdRef.current

    if (activeMapChanged) {
      latestActiveMapIdRef.current = activeMapEntry.id
      latestGraphRevisionRef.current = null
      latestRuntimeSignatureRef.current = ''
      resetForMapChange()
    }

    const runtimeEnvelope = await fetchRuntimeEnvelopeAsset(activeMapEntry.statePath)

    if (!runtimeEnvelope) {
      const runtimeGraph = await fetchGraphAsset(activeMapEntry.graphPath)

      if (runtimeGraph) {
        applyGraphData(runtimeGraph)
      } else {
        applyGraphData(await loadSeedGraph())
      }

      applyRuntimeEnvelope(null)
      latestGraphRevisionRef.current = null
      return
    }

    applyRuntimeEnvelope(runtimeEnvelope)

    if (!activeMapChanged && runtimeEnvelope.graphRevision === latestGraphRevisionRef.current) {
      setGraphLoaded(true)
      return
    }

    const runtimeGraph = await fetchGraphAsset(activeMapEntry.graphPath)

    if (runtimeGraph) {
      applyGraphData(runtimeGraph)
      latestGraphRevisionRef.current = runtimeEnvelope.graphRevision
      return
    }

    applyGraphData(await loadSeedGraph())
    applyRuntimeEnvelope(null)
    latestGraphRevisionRef.current = -1
  }, [resetForMapChange, setGraph, setGraphLoaded, setMapsManifest, setMeta, setRuntimeControls])

  return { loadRuntimeData }
}
