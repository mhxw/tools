'use client'

import { useEffect, useRef } from 'react'
import { DomainChecker } from '../DomainChecker'
import { useSearchParam } from '@/lib/use-search-param'

export function DomainCheckerPage() {
  const rawDomain = useSearchParam('domain')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function applyDomain(value: string) {
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

  function scheduleDomain(value: string, delay: number) {
    if (timer.current) clearTimeout(timer.current)

    if (delay === 0) {
      applyDomain(value)
      return
    }

    // Update the address bar only after the user pauses typing. Rewriting the
    // URL on every keystroke can cause input jank in some browsers.
    timer.current = setTimeout(() => applyDomain(value), delay)
  }

  return (
    <DomainChecker
      initialDomain={rawDomain ?? undefined}
      onInputDomain={(value) => scheduleDomain(value, 350)}
      onQueryDomain={(value) => scheduleDomain(value, 0)}
    />
  )
}
