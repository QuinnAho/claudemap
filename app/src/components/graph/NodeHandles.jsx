import { Handle, Position } from '@xyflow/react'

const HANDLE_POSITIONS = Object.freeze([
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
])

export default function NodeHandles({ style }) {
  return HANDLE_POSITIONS.flatMap(([name, position]) => [
    <Handle
      key={`target-${name}`}
      id={`target-${name}`}
      type="target"
      position={position}
      style={style}
    />,
    <Handle
      key={`source-${name}`}
      id={`source-${name}`}
      type="source"
      position={position}
      style={style}
    />,
  ])
}
