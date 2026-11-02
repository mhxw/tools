'use client'

import { usePathname, useRouter } from 'next/navigation'
import { DomainChecker } from '../DomainChecker'
import { useSearchParam } from '@/lib/use-search-param'

export function DomainCheckerPage() {
  const rawDomain = useSearchParam('domain')
  const router = useRouter()
  const pathname = usePathname()

  function updateDomain(domain: string) {
    const params = new URLSearchParams(window.location.search)
    params.set('domain', domain)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <DomainChecker
      initialDomain={rawDomain ?? undefined}
      onQueryDomain={updateDomain}
    />
  )
}
