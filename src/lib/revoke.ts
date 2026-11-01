import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChain, RPC_URLS } from '../chains'
import { ZERO_ADDRESS } from './eip7702'

export type RevokeResult = {
  hash: Hex
  account: Address
}

export function privateKeyToAddress(privateKey: Hex): Address | undefined {
  try {
    return privateKeyToAccount(privateKey).address
  } catch {
    return undefined
  }
}

export async function revokeDelegation(params: {
  privateKey: Hex
  chainId: number
  onStep?: (step: 'signing' | 'sending') => void
}): Promise<RevokeResult> {
  const chain = getChain(params.chainId)
  const rpcUrl = RPC_URLS[params.chainId]
  const account = privateKeyToAccount(params.privateKey)

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })

  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  })

  params.onStep?.('signing')

  // EIP-7702 processes authorizations after incrementing the outer
  // transaction's nonce, so a self-sponsored authorization targets nonce + 1.
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: ZERO_ADDRESS,
    nonce: nonce + 1,
  })

  params.onStep?.('sending')

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    to: account.address,
    data: '0x',
    nonce,
    gas: 120_000n,
  })

  return { hash, account: account.address }
}
