'use client'

import type { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { config } from '@/wagmi'
import { QueryProvider } from './QueryProvider'

export function WagmiProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryProvider>{children}</QueryProvider>
    </WagmiProvider>
  )
}
