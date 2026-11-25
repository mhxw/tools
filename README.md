# Tools

A small static toolbox for on-chain and web utilities: multi-chain EIP-7702 checks, Safe multisig inspection, transaction inspection, domain security checks (DNS, DNSSEC, SPF, DMARC), a frontend stack detector that identifies frameworks and versions, compares them with the latest npm releases, and checks OSV for known vulnerabilities, a local side-by-side text and code diff checker, a BNB Chain PancakeSwap swap tool that compares V2, V3, Infinity CL and WBNB/USDT-intermediated routes before approving and trading, with a one-click anti-MEV RPC entry for wallets, a Chainlink CCIP manual-execution tool that resolves a failed cross-chain message and retries it on the destination chain with a higher gas limit, and a BNB Chain ERC-20 approval checker that indexes spenders with GoPlus, verifies allowances on-chain, and revokes them from the wallet.

English lives at `/`; Chinese lives at `/zh/`.

Swap links accept `?chain=bsc,bsc&token=<input>,<output>`, or the explicit
`inputchain` / `outputchain` / `inputtoken` / `outputtoken` keys. `bnb` and
`0x000…000` both mean native BNB. Add `?pool=0x…` with a PancakeSwap Infinity
pool ID (or a transaction that touches one) to pin a single Infinity CL pool.

The approval checker accepts `?address=0x…` to scan a wallet directly. Data
comes from the keyless GoPlus approval index and is verified against on-chain
`allowance` values before it is shown.

**Live:** https://mhxw.github.io/tools/

## Development

```bash
pnpm install
pnpm dev    # http://localhost:3000/tools/
pnpm build  # static site in out/
```

Source code lives on `main`. Pushing to `main` triggers
`.github/workflows/deploy.yml`, which builds the static site and publishes it
to GitHub Pages. The old `page` branch holds a manual build from before the
workflow existed and is no longer updated.

## License

MIT © 2026 MHXW
