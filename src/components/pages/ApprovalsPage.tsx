'use client'

import { Approvals } from '../Approvals'
import { WagmiProviders } from '../WagmiProviders'

export function ApprovalsPage() {
  return (
    <WagmiProviders>
      <Approvals />
    </WagmiProviders>
  )
}
