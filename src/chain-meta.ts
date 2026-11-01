/**
 * Lightweight chain metadata for the shell, nav and static pages.
 * Keep this file free of viem/wagmi imports so the home and guide pages do not
 * ship the wallet/RPC stack.
 */

export type ChainMeta = {
  id: number
  name: string
}

export const DEFAULT_CHAIN_ID = 56

export const MAINNET_CHAIN_META: ChainMeta[] = [
  { id: 1, name: 'Ethereum' },
  { id: 56, name: 'BSC' },
  { id: 8453, name: 'Base' },
  { id: 42161, name: 'Arbitrum' },
  { id: 10, name: 'Optimism' },
  { id: 137, name: 'Polygon' },
  { id: 143, name: 'Monad' },
]

export const TESTNET_CHAIN_META: ChainMeta[] = [
  { id: 97, name: 'BSC Testnet' },
  { id: 84532, name: 'Base Sepolia' },
  { id: 10143, name: 'Monad Testnet' },
]

export const CHAIN_NAMES: Record<number, string> = Object.fromEntries(
  [...MAINNET_CHAIN_META, ...TESTNET_CHAIN_META].map((chain) => [
    chain.id,
    chain.name,
  ]),
)

type Explorer = {
  name: string
  url: string
}

const EXPLORERS: Record<number, Explorer> = {
  1: { name: 'Etherscan', url: 'https://etherscan.io' },
  56: { name: 'BscScan', url: 'https://bscscan.com' },
  97: { name: 'BscScan Testnet', url: 'https://testnet.bscscan.com' },
  8453: { name: 'Basescan', url: 'https://basescan.org' },
  84532: {
    name: 'Basescan Sepolia',
    url: 'https://sepolia.basescan.org',
  },
  42161: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  10: {
    name: 'Optimism Explorer',
    url: 'https://optimistic.etherscan.io',
  },
  137: { name: 'PolygonScan', url: 'https://polygonscan.com' },
  143: { name: 'Monadscan', url: 'https://monadscan.com' },
  10143: {
    name: 'Monad Testnet Explorer',
    url: 'https://testnet.monadexplorer.com',
  },
}

export function chainName(chainId: number) {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
}

export function explorerName(chainId: number) {
  return EXPLORERS[chainId]?.name ?? 'Explorer'
}

export function explorerAddressUrl(chainId: number, address: string) {
  const base = EXPLORERS[chainId]?.url
  return base ? `${base}/address/${address}` : undefined
}

export function explorerTxUrl(chainId: number, hash: string) {
  const base = EXPLORERS[chainId]?.url
  return base ? `${base}/tx/${hash}` : undefined
}
