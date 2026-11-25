'use client'

import { CcipRetry } from '../CcipRetry'
import { WagmiProviders } from '../WagmiProviders'

export function CcipRetryPage() {
  return (
    <WagmiProviders>
      <CcipRetry />
    </WagmiProviders>
  )
}
