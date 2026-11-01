'use client'

import { useEffect, useState } from 'react'

/**
 * Read a query parameter after hydration instead of with useSearchParams.
 * This keeps the whole tool page prerendered as static HTML; useSearchParams
 * would force the subtree into client-side rendering up to a Suspense border.
 */
export function useSearchParam(name: string) {
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    // Defer past hydration: remounting a tool from a query parameter during
    // hydration can trigger a text mismatch.
    const timer = window.setTimeout(() => {
      // oxlint-disable-next-line react/set-state-in-effect -- read the URL after hydration
      setValue(new URLSearchParams(window.location.search).get(name))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [name])

  return value
}
