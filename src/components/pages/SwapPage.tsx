'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { PancakeSwap } from '../PancakeSwap'
import { WagmiProviders } from '../WagmiProviders'
import { parseSwapUrl, type SwapUrlState } from '@/lib/pancake-swap'

export function SwapPage() {
  const [initial, setInitial] = useState<SwapUrlState | null>(null)

  useEffect(() => {
    // Read the URL after hydration so the page stays fully prerendered.
    const timer = window.setTimeout(() => {
      // oxlint-disable-next-line react/set-state-in-effect -- read query params after hydration
      setInitial(parseSwapUrl(window.location.search))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const syncTokens = useCallback((from: Address, to: Address) => {
    const params = new URLSearchParams(window.location.search)
    params.set('chain', 'bsc,bsc')
    params.set('token', `${from.toLowerCase()},${to.toLowerCase()}`)
    params.delete('inputchain')
    params.delete('outputchain')
    params.delete('inputtoken')
    params.delete('outputtoken')

    const query = params.toString().replace(/%2C/gi, ',')
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
  }, [])

  return (
    <WagmiProviders>
      <PancakeSwap
        initialFrom={initial?.from}
        initialTo={initial?.to}
        initialChainUnsupported={initial?.chainSupported === false}
        initialInvalidToken={initial?.invalidToken === true}
        onTokensChange={syncTokens}
      />
    </WagmiProviders>
  )
}
