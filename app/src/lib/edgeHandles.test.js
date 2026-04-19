import { describe, expect, it } from 'vitest'
import { chooseEdgeHandles } from './edgeHandles'

function node(x, y, width = 100, height = 50) {
  return { position: { x, y }, width, height }
}

describe('chooseEdgeHandles', () => {
  it('uses right-to-left handles for nodes laid out horizontally', () => {
    expect(chooseEdgeHandles(node(0, 0), node(300, 20))).toEqual({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
    })
  })

  it('uses left-to-right handles when the target is to the left', () => {
    expect(chooseEdgeHandles(node(300, 0), node(0, 20))).toEqual({
      sourceHandle: 'source-left',
      targetHandle: 'target-right',
    })
  })

  it('uses bottom-to-top handles for primarily vertical relationships', () => {
    expect(chooseEdgeHandles(node(0, 0), node(20, 300))).toEqual({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    })
  })

  it('uses bottom-to-top handles for row-to-row diagonals unless horizontal distance dominates', () => {
    expect(chooseEdgeHandles(node(0, 0), node(240, 130))).toEqual({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    })
  })
})
