import { fallback, http } from 'viem'
import { createConfig, type Transport } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { rpcUrls, SUPPORTED_CHAINS } from './chains'

const transports: Record<number, Transport> = {}

for (const chain of SUPPORTED_CHAINS) {
  transports[chain.id] = fallback(
    rpcUrls(chain.id).map((url) =>
      http(url, { timeout: 10_000, retryCount: 0 }),
    ),
  )
}

export const config = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: [injected()],
  transports,
  ssr: false,
})
