'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress, type Address } from 'viem'
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from 'wagmi'
import { AddressChecker } from '../AddressChecker'
import { WagmiProviders } from '../WagmiProviders'
import { useI18n } from '@/i18n'
import { localePath } from '@/tools'
import { useSearchParam } from '@/lib/use-search-param'
import { useToolbox } from '@/toolbox'

export function AddressCheckerPage() {
  return (
    <WagmiProviders>
      <AddressCheckerInner />
    </WagmiProviders>
  )
}

function AddressCheckerInner() {
  const { lang, t } = useI18n()
  const rawAddress = useSearchParam('address')
  const router = useRouter()
  const { chainId, setChainId } = useToolbox()

  const connection = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const switchChain = useSwitchChain()
  const { disconnect } = useDisconnect()
  const syncedChain = useRef<number | undefined>(undefined)

  const initialAddress = rawAddress && isAddress(rawAddress) ? rawAddress : undefined

  // The network selector lives outside the wagmi provider now, so sync the
  // wallet to the selected read-only chain once per selection.
  useEffect(() => {
    if (!connection.isConnected) return
    if (connection.chainId === chainId) {
      syncedChain.current = chainId
      return
    }
    if (syncedChain.current === chainId) return

    syncedChain.current = chainId
    switchChain.mutate({ chainId })
  }, [chainId, connection.isConnected, connection.chainId, switchChain])

  function handleConnect() {
    const connector = connectors[0]
    if (!connector) return
    connect.mutate({ connector })
  }

  async function selectChain(nextChainId: number) {
    setChainId(nextChainId)
    syncedChain.current = nextChainId
    if (connection.isConnected) {
      try {
        await switchChain.mutateAsync({ chainId: nextChainId })
      } catch {
        // Keep the read-only chain selection even if the wallet rejects.
      }
    }
  }

  function openGuide(address: Address) {
    const params = new URLSearchParams({
      address,
      chain: String(chainId),
    })
    router.push(`${localePath(lang, '/eip7702/metamask')}?${params.toString()}`)
  }

  return (
    <>
      {connect.isError && (
        <p className="notice notice-error">
          {t('common.walletConnectFailed', {
            message: connect.error.message,
          })}
        </p>
      )}
      <AddressChecker
        key={initialAddress ?? 'empty'}
        chainId={chainId}
        initialAddress={initialAddress}
        connectedAddress={connection.address}
        connectedChainId={connection.chainId}
        isConnecting={connection.isConnecting}
        onConnect={handleConnect}
        onDisconnect={() => disconnect()}
        onSwitchChain={() => {
          void selectChain(chainId)
        }}
        onSelectChain={(nextChainId) => {
          void selectChain(nextChainId)
        }}
        onOpenGuide={openGuide}
      />
    </>
  )
}
