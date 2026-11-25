/**
 * Chain metadata for CCIP manual execution.
 *
 * The CCIP API tells us the chain ID, but not a usable RPC or wallet
 * parameters. Keep a small static list for the chains this page can read,
 * simulate and (optionally) add to the wallet. Unknown chains still work when
 * the wallet is already configured for them, because simulation and sending go
 * through the wallet's own RPC.
 */

export type CcipChain = {
  id: number
  name: string
  rpc: string
  explorer: string
  currency: { name: string; symbol: string; decimals: number }
}

const eth = { name: 'Ether', symbol: 'ETH', decimals: 18 }
const bnb = { name: 'BNB', symbol: 'BNB', decimals: 18 }
const pol = { name: 'POL', symbol: 'POL', decimals: 18 }
const avax = { name: 'Avalanche', symbol: 'AVAX', decimals: 18 }

export const CCIP_CHAINS: CcipChain[] = [
  {
    id: 1,
    name: 'Ethereum',
    rpc: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
    currency: eth,
  },
  {
    id: 56,
    name: 'BNB Chain',
    rpc: 'https://bsc-rpc.publicnode.com',
    explorer: 'https://bscscan.com',
    currency: bnb,
  },
  {
    id: 8453,
    name: 'Base',
    rpc: 'https://base-rpc.publicnode.com',
    explorer: 'https://basescan.org',
    currency: eth,
  },
  {
    id: 42161,
    name: 'Arbitrum One',
    rpc: 'https://arbitrum-one-rpc.publicnode.com',
    explorer: 'https://arbiscan.io',
    currency: eth,
  },
  {
    id: 10,
    name: 'OP Mainnet',
    rpc: 'https://optimism-rpc.publicnode.com',
    explorer: 'https://optimistic.etherscan.io',
    currency: eth,
  },
  {
    id: 137,
    name: 'Polygon',
    rpc: 'https://polygon-bor-rpc.publicnode.com',
    explorer: 'https://polygonscan.com',
    currency: pol,
  },
  {
    id: 43114,
    name: 'Avalanche',
    rpc: 'https://avalanche-c-chain-rpc.publicnode.com',
    explorer: 'https://snowtrace.io',
    currency: avax,
  },
  {
    id: 59144,
    name: 'Linea',
    rpc: 'https://linea-rpc.publicnode.com',
    explorer: 'https://lineascan.build',
    currency: eth,
  },
  {
    id: 534352,
    name: 'Scroll',
    rpc: 'https://scroll-rpc.publicnode.com',
    explorer: 'https://scrollscan.com',
    currency: eth,
  },
  {
    id: 5000,
    name: 'Mantle',
    rpc: 'https://mantle-rpc.publicnode.com',
    explorer: 'https://mantlescan.xyz',
    currency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  },
  {
    id: 146,
    name: 'Sonic',
    rpc: 'https://sonic-rpc.publicnode.com',
    explorer: 'https://sonicscan.org',
    currency: { name: 'Sonic', symbol: 'S', decimals: 18 },
  },
  {
    id: 100,
    name: 'Gnosis',
    rpc: 'https://gnosis-rpc.publicnode.com',
    explorer: 'https://gnosisscan.io',
    currency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  },
  {
    id: 42220,
    name: 'Celo',
    rpc: 'https://celo-rpc.publicnode.com',
    explorer: 'https://celoscan.io',
    currency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  },
  {
    id: 196,
    name: 'X Layer',
    rpc: 'https://rpc.xlayer.tech',
    explorer: 'https://www.oklink.com/xlayer',
    currency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  },
  {
    id: 80094,
    name: 'Berachain',
    rpc: 'https://berachain-rpc.publicnode.com',
    explorer: 'https://berascan.com',
    currency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  },
  {
    id: 130,
    name: 'Unichain',
    rpc: 'https://unichain-rpc.publicnode.com',
    explorer: 'https://uniscan.xyz',
    currency: eth,
  },
  {
    id: 57073,
    name: 'Ink',
    rpc: 'https://rpc-gel.inkonchain.com',
    explorer: 'https://explorer.inkonchain.com',
    currency: eth,
  },
  {
    id: 1868,
    name: 'Soneium',
    rpc: 'https://rpc.soneium.org',
    explorer: 'https://soneium.blockscout.com',
    currency: eth,
  },
  {
    id: 480,
    name: 'World Chain',
    rpc: 'https://worldchain-mainnet.g.alchemy.com/public',
    explorer: 'https://worldscan.org',
    currency: eth,
  },
  {
    id: 143,
    name: 'Monad',
    rpc: 'https://rpc.monad.xyz',
    explorer: 'https://monadvision.com',
    currency: { name: 'MON', symbol: 'MON', decimals: 18 },
  },
  {
    id: 34443,
    name: 'Mode',
    rpc: 'https://mainnet.mode.network',
    explorer: 'https://modescan.io',
    currency: eth,
  },
  {
    id: 1088,
    name: 'Metis',
    rpc: 'https://andromeda.metis.io/?owner=1088',
    explorer: 'https://andromeda-explorer.metis.io',
    currency: { name: 'Metis', symbol: 'METIS', decimals: 18 },
  },
  {
    id: 2020,
    name: 'Ronin',
    rpc: 'https://api.roninchain.com/rpc',
    explorer: 'https://explorer.roninchain.com',
    currency: { name: 'RON', symbol: 'RON', decimals: 18 },
  },
]

const BY_ID = new Map(CCIP_CHAINS.map((chain) => [chain.id, chain]))

export function ccipChain(chainId: number): CcipChain | undefined {
  return BY_ID.get(chainId)
}

export function ccipChainName(chainId: number, fallback?: string) {
  return ccipChain(chainId)?.name ?? fallback ?? `Chain ${chainId}`
}
