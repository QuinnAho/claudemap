import {
  Clock,
  Code,
  Database,
  FileText,
  GitBranch,
  Globe,
  Layers,
  Lock,
  Mail,
  Puzzle,
  Server,
  Settings,
  Shield,
  Zap,
} from 'lucide-react'

const iconMap = {
  shield: Shield,
  database: Database,
  globe: Globe,
  gear: Settings,
  puzzle: Puzzle,
  route: GitBranch,
  lock: Lock,
  envelope: Mail,
  clock: Clock,
  layers: Layers,
  code: Code,
  file: FileText,
  server: Server,
  zap: Zap,
}

export function getNodeIcon(iconName) {
  return iconMap[iconName] || Code
}
