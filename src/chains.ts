import type { Chain } from 'viem'
import {
  arbitrum,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  mainnet,
  monad,
  monadTestnet,
  optimism,
  polygon,
} from 'viem/chains'

export const ETHEREUM_ID = mainnet.id
export const BSC_MAINNET_ID = bsc.id
export const BSC_TESTNET_ID = bscTestnet.id
export const BASE_MAINNET_ID = base.id
export const BASE_SEPOLIA_ID = baseSepolia.id
export const ARBITRUM_ID = arbitrum.id
export const OPTIMISM_ID = optimism.id
export const POLYGON_ID = polygon.id
export const MONAD_ID = monad.id
export const MONAD_TESTNET_ID = monadTestnet.id

export const MAINNET_CHAINS = [
  mainnet,
  bsc,
  base,
  arbitrum,
  optimism,
  polygon,
  monad,
] as const

export const TESTNET_CHAINS = [bscTestnet, baseSepolia, monadTestnet] as const

export const SUPPORTED_CHAINS = [
  ...MAINNET_CHAINS,
  ...TESTNET_CHAINS,
] as const

/** Networks queried automatically when an address is checked. */
export const SCAN_CHAINS = MAINNET_CHAINS

export const SCAN_CHAIN_IDS: readonly number[] = SCAN_CHAINS.map(
  (chain) => chain.id,
)

export const SUPPORTED_CHAIN_IDS: readonly number[] = SUPPORTED_CHAINS.map(
  (chain) => chain.id,
)

export const DEFAULT_CHAIN_ID = BSC_MAINNET_ID

const rpcUrl = (value: string | undefined, fallback: string) =>
  value && value.trim().length > 0 ? value.trim() : fallback

export const RPC_URLS: Record<number, string> = {
  [ETHEREUM_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL as string | undefined,
    'https://ethereum-rpc.publicnode.com',
  ),
  [BSC_MAINNET_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_BSC_RPC_URL as string | undefined,
    'https://bsc-dataseed.binance.org',
  ),
  [BSC_TESTNET_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL as string | undefined,
    'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  ),
  [BASE_MAINNET_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_BASE_RPC_URL as string | undefined,
    'https://mainnet.base.org',
  ),
  [BASE_SEPOLIA_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL as string | undefined,
    'https://sepolia.base.org',
  ),
  [ARBITRUM_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL as string | undefined,
    'https://arbitrum-one-rpc.publicnode.com',
  ),
  [OPTIMISM_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL as string | undefined,
    'https://optimism-rpc.publicnode.com',
  ),
  [POLYGON_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_POLYGON_RPC_URL as string | undefined,
    'https://polygon.drpc.org',
  ),
  [MONAD_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_MONAD_RPC_URL as string | undefined,
    'https://rpc.monad.xyz',
  ),
  [MONAD_TESTNET_ID]: rpcUrl(
    process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL as string | undefined,
    'https://testnet-rpc.monad.xyz',
  ),
}

/** Optional extra endpoints tried in parallel with the primary RPC. */
export const RPC_FALLBACKS: Record<number, string[]> = {
  [BSC_MAINNET_ID]: ['https://1rpc.io/bnb'],
  [BASE_MAINNET_ID]: ['https://base.drpc.org'],
  [POLYGON_ID]: ['https://1rpc.io/matic'],
}

export function rpcUrls(chainId: number): string[] {
  const primary = RPC_URLS[chainId]
  const fallbacks = RPC_FALLBACKS[chainId] ?? []
  return [primary, ...fallbacks].filter(
    (url, index, all) => Boolean(url) && all.indexOf(url) === index,
  )
}

export function getChain(chainId: number): Chain {
  return (
    SUPPORTED_CHAINS.find((chain) => chain.id === chainId) ?? mainnet
  )
}
