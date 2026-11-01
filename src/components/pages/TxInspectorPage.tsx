'use client'

import { useRouter } from 'next/navigation'
import { isHash, type Hash } from 'viem'
import { TxInspector } from '../TxInspector'
import { WagmiProviders } from '../WagmiProviders'
import { useI18n } from '@/i18n'
import { useSearchParam } from '@/lib/use-search-param'
import { localePath } from '@/tools'
import { useToolbox } from '@/toolbox'

export function TxInspectorPage() {
  return (
    <WagmiProviders>
      <TxInspectorInner />
    </WagmiProviders>
  )
}

function TxInspectorInner() {
  const { lang } = useI18n()
  const rawTx = useSearchParam('tx')
  const router = useRouter()
  const { chainId } = useToolbox()

  const initialTxHash = rawTx && isHash(rawTx) ? rawTx : undefined

  function inspectAddress(address: `0x${string}`) {
    const params = new URLSearchParams({
      address,
      chain: String(chainId),
    })
    router.push(`${localePath(lang, '/eip7702')}?${params.toString()}`)
  }

  return (
    <TxInspector
      key={(initialTxHash as Hash | undefined) ?? 'empty'}
      chainId={chainId}
      initialTxHash={initialTxHash as Hash | undefined}
      onInspectAddress={inspectAddress}
    />
  )
}
