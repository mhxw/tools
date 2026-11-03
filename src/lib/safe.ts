import { encodeFunctionData, type Address, type Hex } from 'viem'

export const SENTINEL_OWNERS =
  '0x0000000000000000000000000000000000000001' as Address

export const SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'VERSION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'nonce',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getTransactionHash',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'execTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'addOwnerWithThreshold',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'prevOwner', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

export type SafeInfo = {
  owners: Address[]
  threshold: bigint
  version: string
  nonce: bigint
}

/**
 * Safe changed its EIP-712 domain in v1.3.0.
 * - 1.0.0 - 1.2.0: EIP712Domain(address verifyingContract)
 * - 1.3.0+:        EIP712Domain(uint256 chainId,address verifyingContract)
 * Neither includes `name` or `version`.
 */
export function safeTxDomain(
  chainId: number,
  safeAddress: Address,
  version: string,
) {
  const [major, minor] = version.split('.').map((part) => Number(part))
  const legacy =
    Number.isFinite(major) &&
    Number.isFinite(minor) &&
    (major < 1 || (major === 1 && minor < 3))

  return legacy
    ? { verifyingContract: safeAddress }
    : { chainId, verifyingContract: safeAddress }
}

export function encodeAddOwner(owner: Address, threshold: bigint): Hex {
  return encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'addOwnerWithThreshold',
    args: [owner, threshold],
  })
}

export function encodeRemoveOwner(
  prevOwner: Address,
  owner: Address,
  threshold: bigint,
): Hex {
  return encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'removeOwner',
    args: [prevOwner, owner, threshold],
  })
}

export function getPrevOwner(owners: Address[], owner: Address) {
  const index = owners.findIndex(
    (candidate) => candidate.toLowerCase() === owner.toLowerCase(),
  )
  if (index < 0) return undefined
  return index === 0 ? SENTINEL_OWNERS : owners[index - 1]
}
