'use client'

import { isAddress } from 'viem'
import { SafeChecker } from '../SafeChecker'
import { WagmiProviders } from '../WagmiProviders'
import { useSearchParam } from '@/lib/use-search-param'
import { useToolbox } from '@/toolbox'

export function SafeCheckerPage() {
  const rawSafe = useSearchParam('safe')
  const { chainId } = useToolbox()
  const initialSafe = rawSafe && isAddress(rawSafe) ? rawSafe : undefined

  function syncSafe(value: string) {
    const params = new URLSearchParams(window.location.search)
    const trimmed = value.trim()
    if (trimmed) params.set('safe', trimmed)
    else params.delete('safe')

    const query = params.toString()
    const hash = window.location.hash
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${hash}`,
    )
  }

  return (
    <WagmiProviders>
      <SafeChecker
        chainId={chainId}
        initialSafe={initialSafe}
        onQuerySafe={syncSafe}
      />
    </WagmiProviders>
  )
}
