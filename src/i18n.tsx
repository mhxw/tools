'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

export type Language = 'zh' | 'en'

const zh = {
  'common.refresh': '刷新',
  'common.refreshing': '刷新中...',
  'common.close': '关闭',
  'common.source': '源码',
  'common.hide': '隐藏',
  'common.show': '显示',
  'common.disconnect': '断开',
  'common.connectWallet': '连接钱包',
  'common.connecting': '连接中...',
  'common.noWallet': '未检测到钱包',
  'common.walletConnectFailed': '钱包连接失败：{message}',
  'common.success': '成功',
  'common.failed': '失败',
  'common.pending': '等待上链',
  'common.copy': '复制',
  'common.copied': '已复制',

  'app.pageTitle': '链上工具箱 · EIP-7702 检测与撤销',
  'app.language': '语言',
  'app.network': '网络',
  'app.mainnets': '主网',
  'app.testnets': '测试网',
  'app.navHome': '工具箱',
  'app.navAddress': '7702 检测',
  'app.navTx': '交易解析',
  'app.navGuide': '撤销指南',
  'app.explainerTitle': 'EIP-7702 是什么？',
  'app.explainer1Title': '代码委托',
  'app.explainer1Body':
    '一笔 type-4 交易可以为 EOA 的 code 写入 `0xef0100 || delegate`。之后调用该 EOA 时，会执行委托地址上的代码，账户因此获得智能合约钱包能力。',
  'app.explainer2Title': '如何识别',
  'app.explainer2Body':
    '使用 `eth_getCode` 读取地址代码：以 `0xef0100` 开头且总长为 23 字节，即为已委托；返回 `0x` 则是普通 EOA。',
  'app.explainer3Title': '如何撤销',
  'app.explainer3Body':
    '对 `address = 0x0` 的授权签名后，发送一笔 type-4 交易。协议会把该账户的代码哈希重置为空，从而清除委托。MetaMask 等智能账户也可以在钱包内关闭。',
  'app.footer1':
    '本工具不托管资产、不上传私钥。私钥模式存在固有风险，请自行审计源码并在可信环境中使用。',
  'app.footer2': '委托合约识别仅覆盖已知实现，未识别的地址请自行核对源码。',

  'home.eyebrow': 'Toolbox',
  'home.title1': '一个链上工具箱，',
  'home.titleAccent': '先查 7702',
  'home.title2': '再决定怎么撤销',
  'home.copy':
    '当前网络：{chain}。输入一个地址即可并行扫描 Ethereum、BSC、Base、Arbitrum、Optimism、Polygon、Monad 等主网，查看哪些网络开启了 EIP-7702 委托，并在需要时撤销授权。',
  'home.meta1': '只读查询无需连接钱包',
  'home.meta2': '私钥签名仅在本地完成',
  'home.meta3':
    'Ethereum / BSC / Base / Arbitrum / Optimism / Polygon / Monad',
  'home.toolsTitle': '选择工具',
  'home.toolsCopy': '所有工具共用顶部的网络与语言设置。',
  'home.open': '打开工具',
  'home.comingTag': '即将上线',
  'home.approvalsTitle': '代币授权检测',
  'home.approvalsDesc':
    '检查 ERC-20 / NFT 的 approve 授权额度，识别高风险授权并引导撤销。',

  'tool.addressTitle': 'EIP-7702 授权检测',
  'tool.addressDesc':
    '输入地址后并行扫描 Ethereum、BSC、Base、Arbitrum、Optimism、Polygon、Monad，识别委托合约，并可切换网络撤销。',
  'tool.addressTag': '多链扫描 · 支持撤销',
  'tool.txTitle': 'EIP-7702 交易解析',
  'tool.txDesc': '读取一笔交易，展示 type-4 授权列表、签名账户、委托地址与 nonce。',
  'tool.txTag': '只读查询',
  'tool.guideTitle': 'MetaMask 取消授权',
  'tool.guideDesc':
    '当钱包不支持 7702 授权签名时，按步骤在 MetaMask 智能账户中关闭委托。',
  'tool.guideTag': '图文步骤',

  'scan.title': '多链扫描',
  'scan.subtitle': '自动查询该地址在 {count} 个网络上的 EIP-7702 委托状态。',
  'scan.scanning': '扫描中',
  'scan.networks': '{count} 个网络',
  'scan.checking': '查询中...',
  'scan.delegated': '已委托',
  'scan.empty': '未开启',
  'scan.contract': '普通合约',
  'scan.error': '查询失败',
  'scan.current': '当前',
  'scan.delegate': '委托至',
  'scan.selectHint':
    '点击任一网络卡片可切换当前网络，查看详情并撤销该网络的委托。',
  'scan.loading': '正在并行读取各网络的链上代码...',
  'scan.summaryDelegated': '在 {count} 个网络发现 EIP-7702 委托：{chains}',
  'scan.summarySafe':
    '已扫描的 {count} 个网络中均未发现 EIP-7702 委托。',
  'scan.partialError':
    '{count} 个网络查询失败。可以点击该网络查看详情，或稍后刷新重试。',
  'scan.testnetNote':
    '当前网络 {chain} 不参与主网自动扫描，但下方详情与撤销仍然可用。',
  'scan.privacy':
    '扫描会把地址发送到各网络的公共 RPC；可在 .env 中替换为自己的 RPC。',

  'addr.eyebrow': '地址检查',
  'addr.title': '这个地址开启了 EIP-7702 吗？',
  'addr.placeholder': '0x... 输入要查询的地址',
  'addr.query': '查询',
  'addr.queryMine': '查询我的地址',
  'addr.inputError': '请输入有效的 EVM 地址（0x 开头，40 位十六进制）',
  'addr.queryAddress': '查询地址',
  'addr.loadingCode': '正在读取链上代码...',
  'addr.queryFailed': '查询失败：{message}',
  'addr.delegatedTitle': '已开启 EIP-7702 委托',
  'addr.delegatedBody':
    '该地址的代码是委托指示器 `0xef0100 || address`，当前委托目标如下。',
  'addr.delegateContract': '委托合约',
  'addr.recognized': '识别结果',
  'addr.rawCode': '原始代码',
  'addr.revokeTitle': '取消委托授权',
  'addr.revokeDescription':
    '撤销会把该地址的代码清空，恢复为普通 EOA。你可以选择本地私钥签名，或在支持智能账户的钱包内直接关闭委托。',
  'addr.revokeCta': '取消委托授权',
  'addr.methodTitle': '选择撤销方式',
  'addr.methodKey': '本地私钥签名',
  'addr.methodWallet': '钱包内取消',
  'addr.walletMethodTitle': '在钱包内关闭委托',
  'addr.methodKeyHint': '适合能导出私钥、而钱包没有 7702 授权接口的地址。',
  'addr.methodWalletHint':
    'MetaMask 智能账户用户可以在钱包里关闭智能账户，每个网络单独操作。',
  'addr.openGuide': '查看 MetaMask 取消教程',
  'addr.guideNote':
    '如果该委托不是 MetaMask 创建的，钱包里可能没有对应开关。请回到原 dApp 撤销，或改用「本地私钥签名」。',
  'addr.securityTitle': '安全提示',
  'addr.securityBody':
    '私钥仅在你的浏览器内存中用于签名，签名后的原始交易直接通过 RPC 广播，不会发送到本工具的服务器。请务必在可信设备上使用，并先自行审计/本地运行本页面。任何情况下都不要把私钥交给他人。',
  'addr.walletMismatch':
    '当前连接的钱包是 {address}，与查询地址不一致。撤销必须使用查询地址本身的私钥。',
  'addr.walletChainMismatch': '钱包网络与当前查询网络不一致。',
  'addr.switchNetwork': '切换网络',
  'addr.privateKeyLabel': '地址私钥',
  'addr.privateKeyPlaceholder': '64 位十六进制，0x 开头可省略（仅本地使用）',
  'addr.invalidKey': '私钥格式不正确',
  'addr.derivedAddressPrefix': '私钥对应地址：',
  'addr.keyMatches': '（与查询地址一致）',
  'addr.keyMismatch': '（与查询地址不一致）',
  'addr.confirmText':
    '我确认这是查询地址的私钥，并了解撤销后该地址将恢复为普通 EOA。',
  'addr.signing': '正在签名...',
  'addr.broadcasting': '正在广播...',
  'addr.confirming': '等待上链确认...',
  'addr.confirmRevoke': '确认取消委托',
  'addr.txSent': '交易已发送，等待确认：',
  'addr.revokeSuccessTitle': '撤销成功',
  'addr.revokeSuccessPrefix': '交易：',
  'addr.revokeSuccessSuffix': '。链上代码已重新读取。',
  'addr.revokeFailedTitle': '撤销失败',
  'addr.notDelegatedTitle': '不是 EIP-7702 委托账户',
  'addr.notDelegatedBody':
    '该地址存在代码，但不是 `0xef0100 || address` 委托指示器，可能是普通合约或其他类型的账户抽象实现。',
  'addr.notEnabledTitle': '未开启 EIP-7702',
  'addr.notEnabledBody': '该地址当前没有代码，是普通 EOA，没有委托授权需要撤销。',
  'addr.rpcUnavailable': 'RPC 客户端不可用，请刷新页面重试',
  'addr.txReverted': '交易已上链但执行失败：{hash}',
  'addr.stillDelegated':
    '交易已上链，但链上代码仍显示委托。可能是授权 nonce 不匹配或 RPC 状态延迟，请点击「刷新」后重试。',

  'guide.eyebrow': '钱包内撤销',
  'guide.title': '在 MetaMask 中取消 EIP-7702 授权',
  'guide.intro':
    'MetaMask 的 Smart Account（智能账户）通过 EIP-7702 把委托写入你的 EOA。同一地址在不同网络的委托互相独立。主流钱包目前没有开放 7702 授权签名接口，所以外部网站通常只能查看委托，撤销需要在 MetaMask 内关闭智能账户。',
  'guide.whyTitle': '适用条件',
  'guide.whyBody':
    '委托是由 MetaMask 智能账户创建的。如果委托来自其他 dApp 或实现，MetaMask 里可能没有对应开关，请回到原 dApp 撤销，或使用本工具箱的「本地私钥签名」方式。',
  'guide.stepsTitle': '操作步骤',
  'guide.step1Title': '打开 MetaMask 并选择账户',
  'guide.step1Body': '在顶部的账户选择器中，切换到需要修复的账户。',
  'guide.step2Title': '进入账户详情',
  'guide.step2Body': '点击账户名旁的三个点（⋮），选择「账户详情 / Account details」。',
  'guide.step3Title': '找到智能账户',
  'guide.step3Body':
    '进入「智能账户 / Smart account / Smart Wallets」区域。不同版本的入口名称可能略有差异。',
  'guide.step4Title': '关闭对应网络的开关',
  'guide.step4Body':
    '在需要恢复的网络上关闭智能账户开关。每个网络都需要单独操作。',
  'guide.step5Title': '确认交易',
  'guide.step5Body': '在钱包中确认交易。该操作需要支付少量 gas。',
  'guide.step6Title': '等待上链并验证',
  'guide.step6Body':
    '交易确认后，该网络的 EIP-7702 委托会被清除，账户恢复为普通 EOA。回到本页重新检测，或查看区块浏览器中的代码是否已为空。',
  'guide.notesTitle': '重要提示',
  'guide.note1':
    '必须按网络分别操作：Ethereum、BNB Chain、Base、Arbitrum、Optimism、Polygon、Monad 等网络各需要一笔交易。',
  'guide.note2':
    '地址、助记词和余额都不会改变，只清除代码委托，账户恢复为普通 EOA。',
  'guide.note3': '确保对应网络有少量 gas，否则交易无法发送。',
  'guide.note4':
    '如果 MetaMask 中没有「智能账户」入口，请升级到最新版本；菜单名称可能随版本变化。',
  'guide.note5':
    '外部网站（包括 revoke.cash）通常只能查看委托，无法替你撤销，必须在钱包内完成。',
  'guide.verifyTitle': '撤销后如何验证',
  'guide.verifyBody':
    '委托状态下，`eth_getCode` 会返回以 `0xef0100` 开头的 23 字节值；撤销成功后应返回 `0x`。也可以在区块浏览器查看地址代码，或回到检测工具重新查询。',
  'guide.openExplorer': '在区块浏览器查看代码',
  'guide.openRevokeCash': '在 revoke.cash 查看委托',
  'guide.checkTitle': '检测一个地址',
  'guide.checkBody': '输入地址后跳转到检测工具，读取当前链上代码。',
  'guide.addressPlaceholder': '0x... 输入要检测的地址',
  'guide.checkButton': '去检测',
  'guide.invalidAddress': '请输入有效的 EVM 地址（0x 开头，40 位十六进制）',
  'guide.recheck': '重新检测此地址',
  'guide.chainHint': '当前网络：{chain}。切换顶部网络后，步骤相同但需要单独发交易。',

  'tx.eyebrow': '交易检查',
  'tx.title': '这笔交易携带了哪些 7702 授权？',
  'tx.multiChain': '多链查找',
  'tx.searchHint':
    '输入交易哈希后会自动查找 Ethereum、BSC、Base、Arbitrum、Optimism、Polygon、Monad 及测试网，无需先切换网络。',
  'tx.searching': '正在从 Ethereum 开始查找各网络...',
  'tx.foundOn': '在 {chain} 找到',
  'tx.notFoundTitle': '未找到该交易',
  'tx.notFoundBody':
    '已在支持的主网和测试网中查找，仍未找到该交易哈希。请确认哈希是否正确。',
  'tx.placeholder': '0x... 输入交易哈希',
  'tx.parse': '解析交易',
  'tx.inputError': '请输入有效的交易哈希（0x 开头，64 位十六进制）',
  'tx.txHash': '交易哈希',
  'tx.loading': '正在读取交易...',
  'tx.parseFailed': '解析失败：{message}',
  'tx.is7702': '这是一笔 EIP-7702 交易',
  'tx.not7702': '这不是 EIP-7702 交易',
  'tx.type': '交易类型：',
  'tx.authCount': '，共携带 {count} 条授权',
  'tx.from': '发送方',
  'tx.to': '接收方',
  'tx.contractCreation': '（合约创建）',
  'tx.blockStatus': '区块 / 状态',
  'tx.authList': '授权列表',
  'tx.signer': '签名账户',
  'tx.unrecoverable': '无法恢复',
  'tx.inspect': '检查该地址',
  'tx.delegate': '委托地址',
  'tx.nonce': '授权 nonce',
  'tx.chainId': '链 ID',
  'tx.signature': '签名',
  'tx.signatureHint':
    '签名由 yParity、r、s 三部分组成，不是可打开的链接。完整值如下，可单独复制。',
  'tx.copySignature': '复制完整签名',
  'tx.copyLink': '复制链接',
} as const

export type MessageKey = keyof typeof zh

const en: Record<MessageKey, string> = {
  'common.refresh': 'Refresh',
  'common.refreshing': 'Refreshing...',
  'common.close': 'Close',
  'common.source': 'Source',
  'common.hide': 'Hide',
  'common.show': 'Show',
  'common.disconnect': 'Disconnect',
  'common.connectWallet': 'Connect wallet',
  'common.connecting': 'Connecting...',
  'common.noWallet': 'No wallet detected',
  'common.walletConnectFailed': 'Wallet connection failed: {message}',
  'common.success': 'Success',
  'common.failed': 'Failed',
  'common.pending': 'Pending',
  'common.copy': 'Copy',
  'common.copied': 'Copied',

  'app.pageTitle': 'Onchain Toolbox · EIP-7702 Inspector & Revoke',
  'app.language': 'Language',
  'app.network': 'Network',
  'app.mainnets': 'Mainnets',
  'app.testnets': 'Testnets',
  'app.navHome': 'Toolbox',
  'app.navAddress': '7702 checker',
  'app.navTx': 'Tx inspector',
  'app.navGuide': 'Revoke guide',
  'app.explainerTitle': 'What is EIP-7702?',
  'app.explainer1Title': 'Code delegation',
  'app.explainer1Body':
    'A type-4 transaction can set an EOA code to `0xef0100 || delegate`. Calls to that EOA then execute the delegate code, giving the account smart-wallet capabilities.',
  'app.explainer2Title': 'How to detect',
  'app.explainer2Body':
    'Call `eth_getCode`. A 23-byte value starting with `0xef0100` means the account is delegated. An empty `0x` response means a normal EOA.',
  'app.explainer3Title': 'How to revoke',
  'app.explainer3Body':
    'Sign an authorization with `address = 0x0` and send a type-4 transaction. The protocol resets the account code hash to empty. Smart-account wallets such as MetaMask can also disable the delegation in-app.',
  'app.footer1':
    'This tool never custodies assets or uploads private keys. Private-key mode has inherent risks; audit the source and use it in a trusted environment.',
  'app.footer2':
    'Delegate recognition only covers known implementations. Verify unknown contracts yourself.',

  'home.eyebrow': 'Toolbox',
  'home.title1': 'One toolbox for on-chain checks,',
  'home.titleAccent': 'start with 7702',
  'home.title2': 'then choose how to revoke',
  'home.copy':
    'Current network: {chain}. Enter one address to scan Ethereum, BSC, Base, Arbitrum, Optimism, Polygon and Monad in parallel, see which networks have EIP-7702 delegation, and revoke it where needed.',
  'home.meta1': 'Read-only checks need no wallet',
  'home.meta2': 'Signing stays in your browser',
  'home.meta3':
    'Ethereum / BSC / Base / Arbitrum / Optimism / Polygon / Monad',
  'home.toolsTitle': 'Choose a tool',
  'home.toolsCopy': 'All tools share the network and language settings above.',
  'home.open': 'Open tool',
  'home.comingTag': 'Coming soon',
  'home.approvalsTitle': 'Token approval checker',
  'home.approvalsDesc':
    'Inspect ERC-20 / NFT approve allowances, spot risky approvals and guide users to revoke them.',

  'tool.addressTitle': 'EIP-7702 delegation checker',
  'tool.addressDesc':
    'Scan Ethereum, BSC, Base, Arbitrum, Optimism, Polygon and Monad in parallel, identify delegate contracts, and revoke per network.',
  'tool.addressTag': 'Multi-chain scan · revoke',
  'tool.txTitle': 'EIP-7702 transaction inspector',
  'tool.txDesc':
    'Read a transaction and show its type-4 authorization list, signers, delegate addresses and nonces.',
  'tool.txTag': 'Read-only',
  'tool.guideTitle': 'Revoke in MetaMask',
  'tool.guideDesc':
    'When your wallet does not expose 7702 authorization signing, disable the delegation inside MetaMask smart accounts.',
  'tool.guideTag': 'Step-by-step',

  'scan.title': 'Multi-chain scan',
  'scan.subtitle':
    'Automatically checks EIP-7702 delegation on {count} networks.',
  'scan.scanning': 'Scanning',
  'scan.networks': '{count} networks',
  'scan.checking': 'Checking...',
  'scan.delegated': 'Delegated',
  'scan.empty': 'Not enabled',
  'scan.contract': 'Contract',
  'scan.error': 'Failed',
  'scan.current': 'Current',
  'scan.delegate': 'to',
  'scan.selectHint':
    'Click a network card to switch the current network, inspect details and revoke on that network.',
  'scan.loading': 'Reading on-chain code from each network in parallel...',
  'scan.summaryDelegated':
    'EIP-7702 delegation found on {count} networks: {chains}',
  'scan.summarySafe':
    'No EIP-7702 delegation found on the {count} scanned networks.',
  'scan.partialError':
    '{count} networks failed to respond. Click one for details or refresh later.',
  'scan.testnetNote':
    'The current network {chain} is not part of the mainnet auto-scan, but details and revocation below still work.',
  'scan.privacy':
    'Scanning sends the address to each network public RPC. Override them with your own RPC in .env.',

  'addr.eyebrow': 'Address check',
  'addr.title': 'Is this address using EIP-7702?',
  'addr.placeholder': '0x... Enter an address',
  'addr.query': 'Check',
  'addr.queryMine': 'Check my address',
  'addr.inputError':
    'Enter a valid EVM address (0x followed by 40 hex characters)',
  'addr.queryAddress': 'Address',
  'addr.loadingCode': 'Reading on-chain code...',
  'addr.queryFailed': 'Query failed: {message}',
  'addr.delegatedTitle': 'EIP-7702 delegation is enabled',
  'addr.delegatedBody':
    'The address code is a delegation indicator (`0xef0100 || address`). It currently points to:',
  'addr.delegateContract': 'Delegate contract',
  'addr.recognized': 'Recognized as',
  'addr.rawCode': 'Raw code',
  'addr.revokeTitle': 'Revoke delegation',
  'addr.revokeDescription':
    "Revoking clears this address's code and restores a normal EOA. Sign locally with the private key, or disable the delegation inside a wallet that supports smart accounts.",
  'addr.revokeCta': 'Revoke delegation',
  'addr.methodTitle': 'Choose a revocation method',
  'addr.methodKey': 'Local private key',
  'addr.methodWallet': 'In-wallet',
  'addr.walletMethodTitle': 'Disable the delegation in your wallet',
  'addr.methodKeyHint':
    'For addresses whose private key you can export when the wallet does not expose 7702 authorization signing.',
  'addr.methodWalletHint':
    'MetaMask smart-account users can disable the smart account in the wallet. Do this per network.',
  'addr.openGuide': 'Open the MetaMask revoke guide',
  'addr.guideNote':
    'If the delegation was not created by MetaMask, the wallet may not offer a switch for it. Return to the original dApp or use "Local private key" instead.',
  'addr.securityTitle': 'Security notice',
  'addr.securityBody':
    "Your private key is used only in browser memory to sign. The signed raw transaction is broadcast directly through RPC and is never sent to this tool's server. Use this page only on a trusted device, and audit or run it locally. Never share your private key with anyone.",
  'addr.walletMismatch':
    'The connected wallet is {address}, which does not match the queried address. Revocation must use the private key of the queried address.',
  'addr.walletChainMismatch':
    'The wallet network does not match the selected network.',
  'addr.switchNetwork': 'Switch network',
  'addr.privateKeyLabel': 'Address private key',
  'addr.privateKeyPlaceholder':
    '64 hex characters; 0x prefix is optional (local use only)',
  'addr.invalidKey': 'Invalid private key format',
  'addr.derivedAddressPrefix': 'Private key address: ',
  'addr.keyMatches': '(matches the queried address)',
  'addr.keyMismatch': '(does not match the queried address)',
  'addr.confirmText':
    'I confirm this is the private key for the queried address and understand that it will become a normal EOA after revocation.',
  'addr.signing': 'Signing...',
  'addr.broadcasting': 'Broadcasting...',
  'addr.confirming': 'Waiting for confirmation...',
  'addr.confirmRevoke': 'Confirm revocation',
  'addr.txSent': 'Transaction sent, waiting for confirmation: ',
  'addr.revokeSuccessTitle': 'Revoked successfully',
  'addr.revokeSuccessPrefix': 'Transaction: ',
  'addr.revokeSuccessSuffix': '. On-chain code has been refreshed.',
  'addr.revokeFailedTitle': 'Revocation failed',
  'addr.notDelegatedTitle': 'Not an EIP-7702 delegation account',
  'addr.notDelegatedBody':
    'This address has code, but it is not a `0xef0100 || address` delegation indicator. It may be a regular contract or another account-abstraction implementation.',
  'addr.notEnabledTitle': 'EIP-7702 is not enabled',
  'addr.notEnabledBody':
    'This address has no code and is a normal EOA. There is no delegation to revoke.',
  'addr.rpcUnavailable': 'RPC client unavailable. Refresh the page and try again.',
  'addr.txReverted': 'Transaction was mined but execution failed: {hash}',
  'addr.stillDelegated':
    'The transaction was mined but the on-chain code still shows a delegation. The authorization nonce may not match, or the RPC state is lagging. Click Refresh and try again.',

  'guide.eyebrow': 'In-wallet revoke',
  'guide.title': 'Cancel EIP-7702 authorization in MetaMask',
  'guide.intro':
    "MetaMask smart accounts use EIP-7702 to write a delegation into your EOA. The same address can have separate delegations on different networks. Mainstream wallets do not expose 7702 authorization signing, so external sites can usually only view the delegation. Revoking it requires disabling the smart account inside MetaMask.",
  'guide.whyTitle': 'When this applies',
  'guide.whyBody':
    'The delegation was created by a MetaMask smart account. If it came from another dApp or implementation, MetaMask may not offer a switch for it. Return to the original dApp or use this toolbox\'s "Local private key" method.',
  'guide.stepsTitle': 'Steps',
  'guide.step1Title': 'Open MetaMask and select the account',
  'guide.step1Body':
    'Use the account selector at the top to switch to the account you want to fix.',
  'guide.step2Title': 'Open account details',
  'guide.step2Body':
    'Click the three dots (⋮) next to the account name and select "Account details".',
  'guide.step3Title': 'Find the smart account',
  'guide.step3Body':
    'Open the "Smart account" / "Smart Wallets" section. Menu labels may differ slightly between versions.',
  'guide.step4Title': 'Turn off the switch for each network',
  'guide.step4Body':
    'Disable the smart account switch on each network you want to revert.',
  'guide.step5Title': 'Confirm the transaction',
  'guide.step5Body':
    'Confirm the transaction in your wallet. A small gas fee is required.',
  'guide.step6Title': 'Wait for confirmation and verify',
  'guide.step6Body':
    'Once confirmed, the EIP-7702 delegation on that network is cleared and the account becomes a normal EOA again. Re-check it here or inspect the address code in a block explorer.',
  'guide.notesTitle': 'Important notes',
  'guide.note1':
    'You must do this per network: Ethereum, BNB Chain, Base, Arbitrum, Optimism, Polygon, Monad and others each need their own transaction.',
  'guide.note2':
    'Your address, seed phrase and balances stay the same — only the code delegation is cleared, returning a normal EOA.',
  'guide.note3':
    'Make sure you have a small amount of gas on the relevant chain.',
  'guide.note4':
    'If MetaMask has no "Smart account" entry, update to the latest version; labels may change between versions.',
  'guide.note5':
    'External sites (including revoke.cash) can usually only view the delegation. You must revoke it inside MetaMask.',
  'guide.verifyTitle': 'How to verify after revoking',
  'guide.verifyBody':
    'While delegated, `eth_getCode` returns 23 bytes starting with `0xef0100`. After a successful revoke it should return `0x`. You can also inspect the address code in a block explorer or re-run the checker.',
  'guide.openExplorer': 'Inspect code in block explorer',
  'guide.openRevokeCash': 'View delegation on revoke.cash',
  'guide.checkTitle': 'Check an address',
  'guide.checkBody':
    'Enter an address to open the checker and read its current on-chain code.',
  'guide.addressPlaceholder': '0x... Enter an address to check',
  'guide.checkButton': 'Check',
  'guide.invalidAddress':
    'Enter a valid EVM address (0x followed by 40 hex characters)',
  'guide.recheck': 'Re-check this address',
  'guide.chainHint':
    'Current network: {chain}. The steps are the same on other networks, but each needs its own transaction.',

  'tx.eyebrow': 'Transaction inspector',
  'tx.title': 'Which 7702 authorizations does this transaction carry?',
  'tx.multiChain': 'Multi-chain lookup',
  'tx.searchHint':
    'Enter a transaction hash to search Ethereum, BSC, Base, Arbitrum, Optimism, Polygon, Monad and testnets automatically. No network switch needed.',
  'tx.searching': 'Searching from Ethereum across supported networks...',
  'tx.foundOn': 'Found on {chain}',
  'tx.notFoundTitle': 'Transaction not found',
  'tx.notFoundBody':
    'Searched the supported mainnets and testnets but could not find this transaction hash. Check the hash and try again.',
  'tx.placeholder': '0x... Enter a transaction hash',
  'tx.parse': 'Inspect transaction',
  'tx.inputError':
    'Enter a valid transaction hash (0x followed by 64 hex characters)',
  'tx.txHash': 'Transaction hash',
  'tx.loading': 'Reading transaction...',
  'tx.parseFailed': 'Inspection failed: {message}',
  'tx.is7702': 'This is an EIP-7702 transaction',
  'tx.not7702': 'This is not an EIP-7702 transaction',
  'tx.type': 'Transaction type: ',
  'tx.authCount': ', containing {count} authorization(s)',
  'tx.from': 'From',
  'tx.to': 'To',
  'tx.contractCreation': '(contract creation)',
  'tx.blockStatus': 'Block / Status',
  'tx.authList': 'Authorization list',
  'tx.signer': 'Signing account',
  'tx.unrecoverable': 'Unable to recover',
  'tx.inspect': 'Check this address',
  'tx.delegate': 'Delegate address',
  'tx.nonce': 'Authorization nonce',
  'tx.chainId': 'Chain ID',
  'tx.signature': 'Signature',
  'tx.signatureHint':
    'A signature has three parts (yParity, r, s); it is not a clickable link. Full values are shown below and can be copied.',
  'tx.copySignature': 'Copy full signature',
  'tx.copyLink': 'Copy link',
}

const messages: Record<Language, Record<MessageKey, string>> = { zh, en }

type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

type I18nContextValue = {
  lang: Language
  t: (key: MessageKey, vars?: Vars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  lang,
  children,
}: {
  lang: Language
  children: ReactNode
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      t: (key, vars) => interpolate(messages[lang][key], vars),
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
