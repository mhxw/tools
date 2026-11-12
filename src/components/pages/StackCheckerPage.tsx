'use client'

import { StackChecker } from '../StackChecker'
import { useSearchParam } from '@/lib/use-search-param'

export function StackCheckerPage() {
  const rawUrl = useSearchParam('url')

  function syncUrl(value: string) {
    const params = new URLSearchParams(window.location.search)
    const trimmed = value.trim()
    if (trimmed) params.set('url', trimmed)
    else params.delete('url')

    const query = params.toString()
    const hash = window.location.hash
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${hash}`,
    )
  }

  return <StackChecker initialUrl={rawUrl ?? undefined} onQueryUrl={syncUrl} />
}
