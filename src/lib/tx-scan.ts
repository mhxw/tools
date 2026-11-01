import {
  createPublicClient,
  http,
  type Address,
  type Hash,
  type Transaction,
  type TransactionReceipt,
} from 'viem'
import { recoverAuthorizationAddress } from 'viem/utils'
import { getChain, rpcUrls, SUPPORTED_CHAIN_IDS } from '../chains'

export type RecoveredAuthorization = NonNullable<
  Transaction['authorizationList']
>[number] & {
  authority?: Address
}

export type FoundTransaction = {
  chainId: number
  transaction: Transaction
  receipt?: TransactionReceipt
  authorizations: RecoveredAuthorization[]
}

async function readTransaction(url: string, chainId: number, hash: Hash) {
  const client = createPublicClient({
    chain: getChain(chainId),
    transport: http(url, { timeout: 8_000, retryCount: 0 }),
  })

  // Raw request first so "not found" (null) is distinct from an RPC failure
  // and does not trigger the fallback endpoint.
  const raw = await client.request({
    method: 'eth_getTransactionByHash',
    params: [hash],
  })
  if (!raw) return null

  const transaction = await client.getTransaction({ hash })

  let receipt: TransactionReceipt | undefined
  try {
    receipt = await client.getTransactionReceipt({ hash })
  } catch {
    // Pending transactions have no receipt yet.
  }

  const authorizations = await Promise.all(
    (transaction.authorizationList ?? []).map(async (authorization) => ({
      ...authorization,
      authority: await recoverAuthorizationAddress({
        authorization,
      }).catch(() => undefined),
    })),
  )

  return { chainId, transaction, receipt, authorizations }
}

async function tryChain(
  chainId: number,
  hash: Hash,
): Promise<FoundTransaction | null> {
  let lastError: unknown

  for (const url of rpcUrls(chainId)) {
    try {
      const result = await readTransaction(url, chainId, hash)
      if (!result) return null
      return result
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    // All endpoints failed; report as not found rather than blocking the scan.
    return null
  }
  return null
}

/**
 * Resolve with the first non-null result, or null when every lookup finishes
 * without finding anything. Unlike Promise.all this does not wait for slow
 * chains after a match is found.
 */
function firstFound(
  promises: Array<Promise<FoundTransaction | null>>,
): Promise<FoundTransaction | null> {
  return new Promise((resolve) => {
    let remaining = promises.length
    if (remaining === 0) {
      resolve(null)
      return
    }

    for (const promise of promises) {
      promise
        .then((value) => {
          if (value) resolve(value)
        })
        .catch(() => undefined)
        .finally(() => {
          remaining -= 1
          if (remaining === 0) resolve(null)
        })
    }
  })
}

/**
 * Find a transaction by hash across supported networks.
 * Ethereum mainnet is checked first, then the remaining networks are raced.
 */
export async function findTransaction(hash: Hash): Promise<FoundTransaction | null> {
  const [firstChainId, ...restChainIds] = SUPPORTED_CHAIN_IDS

  const first = await tryChain(firstChainId, hash)
  if (first) return first

  return firstFound(restChainIds.map((chainId) => tryChain(chainId, hash)))
}
