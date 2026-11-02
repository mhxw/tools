import type { Language, MessageKey } from './i18n'

export type ToolId = 'home' | 'address' | 'tx' | 'domain' | 'guide'
export type ReadyToolId = Exclude<ToolId, 'home'>

type ToolBase = {
  icon: string
  title: MessageKey
  description: MessageKey
  tag: MessageKey
}

export type ReadyTool = ToolBase & {
  id: ReadyToolId
  status: 'ready'
}

export type ComingTool = ToolBase & {
  id: string
  status: 'coming'
}

export type ToolDefinition = ReadyTool | ComingTool

/**
 * Toolbox registry. Add a ready tool here together with a route entry below,
 * or add a `coming` card to reserve space for the next utility.
 */
export const TOOLS: ToolDefinition[] = [
  {
    id: 'address',
    status: 'ready',
    icon: '7702',
    title: 'tool.addressTitle',
    description: 'tool.addressDesc',
    tag: 'tool.addressTag',
  },
  {
    id: 'tx',
    status: 'ready',
    icon: 'TX',
    title: 'tool.txTitle',
    description: 'tool.txDesc',
    tag: 'tool.txTag',
  },
  {
    id: 'domain',
    status: 'ready',
    icon: 'DNS',
    title: 'tool.domainTitle',
    description: 'tool.domainDesc',
    tag: 'tool.domainTag',
  },
  {
    id: 'guide',
    status: 'ready',
    icon: 'MM',
    title: 'tool.guideTitle',
    description: 'tool.guideDesc',
    tag: 'tool.guideTag',
  },
  {
    id: 'approvals',
    status: 'coming',
    icon: 'AP',
    title: 'home.approvalsTitle',
    description: 'home.approvalsDesc',
    tag: 'home.comingTag',
  },
]

export const TOOL_PATHS: Record<ToolId, string> = {
  home: '/',
  address: '/eip7702',
  tx: '/eip7702/tx',
  domain: '/domain',
  guide: '/eip7702/metamask',
}

export function toolFromPath(pathname: string): ToolId {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/eip7702/tx') return 'tx'
  if (path === '/eip7702/metamask') return 'guide'
  if (path === '/eip7702') return 'address'
  if (path === '/domain') return 'domain'
  return 'home'
}

export function localePath(lang: Language, path: string) {
  if (lang !== 'zh') return path
  return path === '/' ? '/zh' : `/zh${path}`
}

export function stripLocale(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/zh') return '/'
  if (path.startsWith('/zh/')) return path.slice(3)
  return path
}
