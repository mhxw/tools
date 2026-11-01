'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CHAIN_NAMES, DEFAULT_CHAIN_ID } from './chain-meta'

type ToolboxContextValue = {
  chainId: number
  setChainId: (chainId: number) => void
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null)

export function ToolboxProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useState<number>(DEFAULT_CHAIN_ID)

  // Read ?chain= once on the client. The static HTML always renders the
  // default chain, then swaps to the requested one after hydration.
  useEffect(() => {
    const fromUrl = Number(
      new URLSearchParams(window.location.search).get('chain'),
    )
    // oxlint-disable-next-line react/set-state-in-effect -- read ?chain= after hydration
    if (CHAIN_NAMES[fromUrl]) setChainId(fromUrl)
  }, [])

  const value = useMemo<ToolboxContextValue>(
    () => ({ chainId, setChainId }),
    [chainId],
  )

  return (
    <ToolboxContext.Provider value={value}>{children}</ToolboxContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useToolbox() {
  const context = useContext(ToolboxContext)
  if (!context) throw new Error('useToolbox must be used inside ToolboxProvider')
  return context
}
