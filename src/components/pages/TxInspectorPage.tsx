'use client'

import { usePathname, useRouter } from 'next/navigation'
import { isHash, type Address, type Hash } from 'viem'
import { QueryProvider } from '../QueryProvider'
import { TxInspector } from '../TxInspector'
import { useI18n } from '@/i18n'
import { useSearchParam } from '@/lib/use-search-param'
import { localePath } from '@/tools'
import { useToolbox } from '@/toolbox'

export function TxInspectorPage() {
  return (
    <QueryProvider>
      <TxInspectorInner />
    </QueryProvider>
  )
}

function TxInspectorInner() {
  const { lang } = useI18n()
  const rawTx = useSearchParam('tx')
  const router = useRouter()
  const pathname = usePathname()
  const { chainId, setChainId } = useToolbox()

  const initialTxHash = rawTx && isHash(rawTx) ? (rawTx as Hash) : undefined

  function updateHashInUrl(hash: Hash) {
    const params = new URLSearchParams(window.location.search)
    params.set('tx', hash)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function inspectAddress(address: Address, foundChainId: number) {
    const params = new URLSearchParams({
      address,
      chain: String(foundChainId),
    })
    router.push(`${localePath(lang, '/eip7702')}?${params.toString()}`)
  }

  return (
    <TxInspector
      key={initialTxHash ?? 'empty'}
      chainId={chainId}
      initialTxHash={initialTxHash}
      onSelectChain={setChainId}
      onQueryHash={updateHashInUrl}
      onInspectAddress={inspectAddress}
    />
  )
}
