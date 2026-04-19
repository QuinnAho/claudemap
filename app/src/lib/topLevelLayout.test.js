import { describe, expect, it } from 'vitest'
import { buildTopLevelLayoutModel, reflowTopLevelLayout } from './topLevelLayout'

function systemNode(id, x, y, width = 100, height = 50) {
  return {
    id,
    type: 'system',
    width,
    height,
    position: { x, y },
    data: { label: id },
  }
}

function mapById(nodes) {
  return new Map(nodes.map((node) => [node.id, node]))
}

describe('reflowTopLevelLayout', () => {
  it('only pushes lower-layer nodes anchored under the expanded top-level node', () => {
    const previousNodes = [
      systemNode('top-left', 0, 0),
      systemNode('top-right', 220, 0),
      systemNode('bottom-left', 0, 150),
      systemNode('bottom-right', 220, 150),
    ]
    const model = buildTopLevelLayoutModel(previousNodes)
    const currentNodes = previousNodes.map((node) =>
      node.id === 'top-left'
        ? { ...node, height: 120 }
        : node,
    )

    const positions = reflowTopLevelLayout({
      nodes: currentNodes,
      previousNodesById: mapById(previousNodes),
      previousPositionsById: model.preferredPositionsById,
      layoutModel: model,
      changedNodeIds: new Set(['top-left']),
    })

    expect(positions.get('bottom-left').y).toBe(220)
    expect(positions.get('bottom-right').y).toBe(150)
  })
})
