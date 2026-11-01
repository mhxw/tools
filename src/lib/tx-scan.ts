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

async function tryChain(
  chainId: number,
  hash: Hash,
): Promise<FoundTransaction | null> {
  const chain = getChain(chainId)

  const attempts = rpcUrls(chainId).map(async (url) => {
    const client = createPublicClient({
      chain,
      transport: http(url, { timeout: 8_000, retryCount: 0 }),
    })

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
  })

  try {
    return await Promise.any(attempts)
  } catch {
    return null
  }
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
