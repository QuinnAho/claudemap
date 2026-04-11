import ELK from 'elkjs/lib/elk.bundled.js'
import { getSystemNodeWidth, SYSTEM_NODE_LAYOUT_HEIGHT } from '../components/graph/systemNodeSizing'

const elk = new ELK()

const defaultOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.padding': '[top=50,left=50,bottom=50,right=50]',
}

export async function computeLayout(nodes, edges) {
  const elkNodes = nodes.map((node) => ({
    id: node.id,
    width: node.width || getSystemNodeWidth(node.data?.lineCount),
    height: node.height || SYSTEM_NODE_LAYOUT_HEIGHT,
  }))

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }))

  const graph = {
    id: 'root',
    layoutOptions: defaultOptions,
    children: elkNodes,
    edges: elkEdges,
  }

  const layout = await elk.layout(graph)
  const layoutNodes = new Map((layout.children || []).map((node) => [node.id, node]))

  return nodes.map((node) => {
    const elkNode = layoutNodes.get(node.id)

    if (!elkNode) {
      return node
    }

    return {
      ...node,
      position: {
        x: elkNode.x,
        y: elkNode.y,
      },
    }
  })
}
