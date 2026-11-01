import { createPublicClient, http, type Address } from 'viem'
import { getChain, rpcUrls, SCAN_CHAIN_IDS } from '../chains'
import { parseDelegation, type DelegationInfo } from './eip7702'

export type ChainScanResult = {
  chainId: number
  info?: DelegationInfo
  error?: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function readCode(chainId: number, address: Address) {
  const chain = getChain(chainId)
  let lastError: unknown

  // Try fallbacks one by one; a successful empty-code read must not trigger
  // extra requests to other RPCs.
  for (const url of rpcUrls(chainId)) {
    try {
      const client = createPublicClient({
        chain,
        transport: http(url, {
          timeout: 8_000,
          retryCount: 0,
        }),
      })
      return await client.getCode({ address })
    } catch (error) {
      lastError = new Error(
        `${new URL(url).host}: ${errorMessage(error)}`,
      )
    }
  }

  throw lastError ?? new Error('No RPC endpoint configured')
}

/**
 * Read `eth_getCode` for an address on every scanned network in parallel.
 * Individual network failures are reported per chain instead of failing the
 * whole scan.
 */
export async function scanDelegations(
  address: Address,
  chainIds: readonly number[] = SCAN_CHAIN_IDS,
): Promise<ChainScanResult[]> {
  return Promise.all(
    chainIds.map(async (chainId) => {
      try {
        const code = await readCode(chainId, address)
        return { chainId, info: parseDelegation(code) }
      } catch (error) {
        return { chainId, error: errorMessage(error) }
      }
    }),
  )
}
