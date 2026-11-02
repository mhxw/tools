import type { Language, MessageKey } from './i18n'

export type ToolId = 'home' | 'address' | 'tx' | 'domain' | 'guide'
export type TopLevelToolId = 'home' | 'eip7702' | 'domain'
export type Eip7702ToolId = 'address' | 'tx' | 'guide'
export type ReadyToolId = 'eip7702' | 'domain'

type ToolBase = {
  icon: string
  title: MessageKey
  description: MessageKey
  tag: MessageKey
}

export type ReadyTool = ToolBase & {
  id: ReadyToolId
  status: 'ready'
  path: string
}

export type ComingTool = ToolBase & {
  id: string
  status: 'coming'
}

export type ToolDefinition = ReadyTool | ComingTool

/**
 * Top-level toolbox modules. EIP-7702 owns its own sub-tools (checker,
 * transaction inspector, revoke guide); they are not separate top-level
 * modules.
 */
export const TOP_LEVEL_TOOLS: ToolDefinition[] = [
  {
    id: 'eip7702',
    status: 'ready',
    icon: '7702',
    title: 'tool.eip7702Title',
    description: 'tool.eip7702Desc',
    tag: 'tool.eip7702Tag',
    path: '/eip7702',
  },
  {
    id: 'domain',
    status: 'ready',
    icon: 'DNS',
    title: 'tool.domainTitle',
    description: 'tool.domainDesc',
    tag: 'tool.domainTag',
    path: '/domain',
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

export const EIP7702_SUB_TOOLS: Array<{
  id: Eip7702ToolId
  path: string
  label: MessageKey
}> = [
  { id: 'address', path: '/eip7702', label: 'app.navAddress' },
  { id: 'tx', path: '/eip7702/tx', label: 'app.navTx' },
  { id: 'guide', path: '/eip7702/metamask', label: 'app.navGuide' },
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

export function topLevelFromPath(pathname: string): TopLevelToolId {
  const path = stripLocale(pathname)

  if (path === '/domain' || path.startsWith('/domain/')) return 'domain'
  if (path === '/eip7702' || path.startsWith('/eip7702/')) return 'eip7702'
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
