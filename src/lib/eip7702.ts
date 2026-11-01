import { getAddress, type Address, type Hex } from 'viem'

export const DELEGATION_PREFIX = '0xef0100'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const EIP7702_TX_TYPE = 'eip7702'

export type DelegationInfo =
  | { status: 'empty'; code: '0x' }
  | { status: 'delegated'; delegate: Address; code: Hex }
  | { status: 'contract'; code: Hex }

export function parseDelegation(code: Hex | null | undefined): DelegationInfo {
  if (!code || code === '0x') return { status: 'empty', code: '0x' }

  const normalized = code.toLowerCase()
  if (
    normalized.startsWith(DELEGATION_PREFIX) &&
    normalized.length >= DELEGATION_PREFIX.length + 40
  ) {
    const delegateHex = normalized.slice(
      DELEGATION_PREFIX.length,
      DELEGATION_PREFIX.length + 40,
    )
    return {
      status: 'delegated',
      delegate: getAddress(`0x${delegateHex}`),
      code,
    }
  }

  return { status: 'contract', code }
}

export function isDelegationCode(code: Hex | null | undefined) {
  return parseDelegation(code).status === 'delegated'
}

type KnownDelegate = {
  name: string
  description: { zh: string; en: string }
  url?: string
}

export const KNOWN_DELEGATES: Record<string, KnownDelegate> = {
  '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b': {
    name: 'MetaMask EIP7702StatelessDeleGator',
    description: {
      zh: 'MetaMask Smart Accounts 的 EIP-7702 委托实现。委托到该地址后，账户会具备批量执行、委托授权等智能账户能力。',
      en: "MetaMask Smart Accounts' EIP-7702 delegation implementation. Delegating to this address gives the account smart-account capabilities such as batched execution and delegation.",
    },
    url: 'https://github.com/MetaMask/delegation-framework',
  },
}

export function getKnownDelegate(delegate: Address | string) {
  return KNOWN_DELEGATES[delegate.toLowerCase()]
}

export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address
  return `${address.slice(0, head)}...${address.slice(-tail)}`
}
