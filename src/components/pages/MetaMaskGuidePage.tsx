'use client'

import { useRouter } from 'next/navigation'
import { isAddress, type Address } from 'viem'
import { MetaMaskGuide } from '../MetaMaskGuide'
import { useI18n } from '@/i18n'
import { useSearchParam } from '@/lib/use-search-param'
import { localePath } from '@/tools'
import { useToolbox } from '@/toolbox'

export function MetaMaskGuidePage() {
  const { lang } = useI18n()
  const rawAddress = useSearchParam('address')
  const router = useRouter()
  const { chainId } = useToolbox()

  const address = rawAddress && isAddress(rawAddress) ? rawAddress : undefined

  function checkAddress(next: Address) {
    const params = new URLSearchParams({
      address: next,
      chain: String(chainId),
    })
    router.push(`${localePath(lang, '/eip7702')}?${params.toString()}`)
  }

  return (
    <MetaMaskGuide
      key={address ?? 'empty'}
      chainId={chainId}
      address={address}
      onCheckAddress={checkAddress}
    />
  )
}
