import { describe, expect, it } from 'vitest'
import { buildSemanticGroups, computeSemanticTopLevelLayout } from './semanticTopLevelLayout'

function systemNode(id, label, filePath) {
  return {
    id,
    type: 'system',
    width: 200,
    height: 84,
    position: { x: 0, y: 0 },
    data: {
      label,
      filePath,
    },
  }
}

describe('buildSemanticGroups', () => {
  it('groups top-level systems by path neighborhood', () => {
    const groups = buildSemanticGroups([
      systemNode('backend-runtime', 'Backend Runtime', 'backend/'),
      systemNode('frontend-shell', 'Frontend Shell', 'frontend/'),
      systemNode('backend-auth', 'Backend Auth', 'backend/src'),
    ])

    expect(groups.map((group) => group.key)).toEqual(['frontend', 'backend'])
    expect(groups.find((group) => group.key === 'backend').nodes.map((node) => node.id)).toEqual([
      'backend-runtime',
      'backend-auth',
    ])
  })
})

describe('computeSemanticTopLevelLayout', () => {
  it('places frontend and backend neighborhoods as horizontal map regions', () => {
    const nodes = [
      systemNode('backend-runtime', 'Backend Runtime', 'backend/'),
      systemNode('backend-auth', 'Backend Auth', 'backend/src'),
      systemNode('backend-operations', 'Backend Operations', 'backend/src/routes'),
      systemNode('backend-scripts', 'Backend Scripts', 'backend/scripts'),
      systemNode('frontend-shell', 'Frontend Shell', 'frontend/'),
      systemNode('frontend-portals', 'Frontend Portals', 'frontend/src/pages'),
      systemNode('frontend-services', 'Frontend Services', 'frontend/src/services'),
    ]

    const positioned = computeSemanticTopLevelLayout(nodes)
    const byId = new Map(positioned.map((node) => [node.id, node]))

    expect(positioned).not.toBe(null)
    expect(byId.get('frontend-shell').position.x).toBeLessThan(byId.get('backend-runtime').position.x)
    expect(byId.get('frontend-shell').position.y).toBe(byId.get('frontend-portals').position.y)
    expect(byId.get('frontend-services').position.y).toBeGreaterThan(byId.get('frontend-shell').position.y)
    expect(byId.get('backend-runtime').position.y).toBe(byId.get('backend-auth').position.y)
    expect(byId.get('backend-operations').position.y).toBeGreaterThan(byId.get('backend-runtime').position.y)
  })

  it('swaps local row pairs when that reduces diagonal edges inside a neighborhood', () => {
    const nodes = [
      systemNode('backend-runtime', 'Backend Runtime', 'backend/'),
      systemNode('backend-auth', 'Backend Auth', 'backend/src'),
      systemNode('backend-operations', 'Backend Operations', 'backend/src/routes'),
      systemNode('backend-scripts', 'Backend Scripts', 'backend/scripts'),
      systemNode('frontend-shell', 'Frontend Shell', 'frontend/'),
    ]
    const positioned = computeSemanticTopLevelLayout(nodes, [
      { id: 'runtime-to-scripts', source: 'backend-runtime', target: 'backend-scripts' },
      { id: 'operations-to-auth', source: 'backend-operations', target: 'backend-auth' },
    ])
    const byId = new Map(positioned.map((node) => [node.id, node]))

    expect(byId.get('backend-runtime').position.x).toBeLessThan(byId.get('backend-auth').position.x)
    expect(byId.get('backend-scripts').position.x).toBe(byId.get('backend-runtime').position.x)
    expect(byId.get('backend-operations').position.x).toBe(byId.get('backend-auth').position.x)
  })

  it('falls back for tiny graphs where a semantic map would add noise', () => {
    const positioned = computeSemanticTopLevelLayout([
      systemNode('a', 'A', 'a/'),
      systemNode('b', 'B', 'b/'),
      systemNode('c', 'C', 'c/'),
    ])

    expect(positioned).toBe(null)
  })
})
