'use client'

import { DomainChecker } from '../DomainChecker'
import { useSearchParam } from '@/lib/use-search-param'

export function DomainCheckerPage() {
  const rawDomain = useSearchParam('domain')

  function syncDomain(value: string) {
    const params = new URLSearchParams(window.location.search)
    const trimmed = value.trim()
    if (trimmed) params.set('domain', trimmed)
    else params.delete('domain')

    const query = params.toString()
    const hash = window.location.hash
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${hash}`,
    )
  }

  return (
    <DomainChecker
      initialDomain={rawDomain ?? undefined}
      onQueryDomain={syncDomain}
    />
  )
}
