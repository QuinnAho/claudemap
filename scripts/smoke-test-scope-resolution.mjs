#!/usr/bin/env node

// smoke-test-scope-resolution exercises every branch of
// resolveScopeAgainstGraph and asserts the strategy tag that came back.
// The architecture review (Phase 4 item 3) calls for callers to receive
// {system, strategy} with strategy in the documented union. These tests
// enforce that contract end-to-end through the skill/lib/map-manifest
// barrel so a regression in the resolver or the barrel fails fast.
//
// Run: node scripts/smoke-test-scope-resolution.js

import {
  computeScopeFingerprint,
  resolveScopeAgainstGraph,
} from '../skill/lib/map-manifest.js'

const failures = []

function check(description, actual, expected) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    failures.push({ description, actual: actualJson, expected: expectedJson })
    console.error(`FAIL  ${description}`)
    console.error(`  expected: ${expectedJson}`)
    console.error(`  actual:   ${actualJson}`)
    return
  }

  console.log(`PASS  ${description}`)
}

function graphWithSystems(...systems) {
  return { nodes: systems, edges: [] }
}

// === id strategy ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'a' },
    { id: 'sys-b', type: 'system', label: 'Beta', parentId: null, filePath: 'b' },
  )
  const resolved = resolveScopeAgainstGraph({ rootSystemId: 'sys-a' }, graph)
  check('id strategy returns matching node', resolved?.system?.id, 'sys-a')
  check('id strategy tag', resolved?.strategy, 'id')
}

// === path strategy ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'app/alpha' },
    { id: 'sys-b', type: 'system', label: 'Beta', parentId: null, filePath: 'app/beta' },
  )
  const resolved = resolveScopeAgainstGraph({ filePathHint: 'app/beta' }, graph)
  check('path strategy returns matching node', resolved?.system?.id, 'sys-b')
  check('path strategy tag', resolved?.strategy, 'path')
}

// === fingerprint strategy ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'a' },
    { id: 'sys-b', type: 'system', label: 'Beta', parentId: 'sys-a', filePath: 'a/b' },
  )
  const fingerprint = computeScopeFingerprint(graph, 'sys-b')
  const resolved = resolveScopeAgainstGraph({ fingerprint }, graph)
  check('fingerprint strategy returns matching node', resolved?.system?.id, 'sys-b')
  check('fingerprint strategy tag', resolved?.strategy, 'fingerprint')
}

// === ancestor-label strategy ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'a' },
    { id: 'sys-b', type: 'system', label: 'Beta', parentId: 'sys-a', filePath: 'a/b' },
    { id: 'sys-c', type: 'system', label: 'Beta', parentId: null, filePath: 'c' },
  )
  const resolved = resolveScopeAgainstGraph(
    { rootSystemLabel: 'Beta', ancestorPath: ['Alpha'] },
    graph,
  )
  check('ancestor-label strategy picks the node with matching chain', resolved?.system?.id, 'sys-b')
  check('ancestor-label strategy tag', resolved?.strategy, 'ancestor-label')
}

// === ancestor-label-ambiguous sentinel ===
{
  const graph = graphWithSystems(
    { id: 'sys-a1', type: 'system', label: 'Alpha', parentId: null, filePath: 'a1' },
    { id: 'sys-a2', type: 'system', label: 'Alpha', parentId: null, filePath: 'a2' },
    { id: 'sys-b1', type: 'system', label: 'Beta', parentId: 'sys-a1', filePath: 'a1/b' },
    { id: 'sys-b2', type: 'system', label: 'Beta', parentId: 'sys-a2', filePath: 'a2/b' },
  )
  const resolved = resolveScopeAgainstGraph(
    { rootSystemLabel: 'Beta', ancestorPath: ['Alpha'] },
    graph,
  )
  check('ancestor-label-ambiguous returns first candidate', resolved?.system?.id, 'sys-b1')
  check('ancestor-label-ambiguous strategy tag', resolved?.strategy, 'ancestor-label-ambiguous')
}

// === label strategy ===
{
  const graph = graphWithSystems(
    { id: 'sys-x', type: 'system', label: 'Unique', parentId: null, filePath: 'x' },
    { id: 'sys-y', type: 'system', label: 'Other', parentId: null, filePath: 'y' },
  )
  // No ancestor path provided -> ancestor-label requires both ancestors match,
  // which here degenerates to the same check as label. Force a pure-label
  // match by asking for a label whose ancestor chain is empty.
  const resolved = resolveScopeAgainstGraph({ rootSystemLabel: 'Unique' }, graph)
  check('label strategy returns matching node', resolved?.system?.id, 'sys-x')
  // A single-root match with no ancestor path lands in ancestor-label first
  // because the ancestor chain is trivially equal (both empty). That is the
  // documented behavior; the label branch is the fallback when the ancestor
  // branch fails. This assertion just pins the priority order.
  check('label strategy tag for root-level unique label', resolved?.strategy, 'ancestor-label')
}

// === label-only fallback after ancestor mismatch ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'a' },
    { id: 'sys-t', type: 'system', label: 'Target', parentId: 'sys-a', filePath: 'a/t' },
  )
  // Ancestor chain is wrong (expects 'Bravo' parent, actual is 'Alpha'), so
  // ancestor-label fails, but label fallback still finds the unique Target.
  const resolved = resolveScopeAgainstGraph(
    { rootSystemLabel: 'Target', ancestorPath: ['Bravo'] },
    graph,
  )
  check('label fallback returns node after ancestor mismatch', resolved?.system?.id, 'sys-t')
  check('label fallback strategy tag', resolved?.strategy, 'label')
}

// === miss ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'a' },
  )
  const resolved = resolveScopeAgainstGraph({ rootSystemLabel: 'Nonexistent' }, graph)
  check('no match returns null', resolved, null)
}

// === null scope / empty graph ===
{
  check('null scope returns null', resolveScopeAgainstGraph(null, graphWithSystems()), null)
  check(
    'empty graph returns null',
    resolveScopeAgainstGraph({ rootSystemId: 'whatever' }, graphWithSystems()),
    null,
  )
}

// === strategy tag set matches contract ===
{
  const graph = graphWithSystems(
    { id: 'sys-a', type: 'system', label: 'Alpha', parentId: null, filePath: 'a' },
    { id: 'sys-b', type: 'system', label: 'Beta', parentId: 'sys-a', filePath: 'a/b' },
  )
  const observedTags = new Set()
  observedTags.add(resolveScopeAgainstGraph({ rootSystemId: 'sys-a' }, graph).strategy)
  observedTags.add(resolveScopeAgainstGraph({ filePathHint: 'a/b' }, graph).strategy)
  observedTags.add(
    resolveScopeAgainstGraph(
      { fingerprint: computeScopeFingerprint(graph, 'sys-b') },
      graph,
    ).strategy,
  )
  observedTags.add(
    resolveScopeAgainstGraph(
      { rootSystemLabel: 'Beta', ancestorPath: ['Alpha'] },
      graph,
    ).strategy,
  )
  const expectedCoreTags = ['id', 'path', 'fingerprint', 'ancestor-label']
  for (const tag of expectedCoreTags) {
    check(`observed core strategy tag: ${tag}`, observedTags.has(tag), true)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s).`)
  process.exit(1)
}

console.log(`\nAll scope-resolution smoke tests passed.`)
