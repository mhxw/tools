# Tools

A small static toolbox for on-chain and web utilities: multi-chain EIP-7702 checks, Safe multisig inspection, transaction inspection, domain security checks (DNS, DNSSEC, SPF, DMARC), a frontend stack detector that identifies frameworks and versions, compares them with the latest npm releases, and checks OSV for known vulnerabilities, a local side-by-side text and code diff checker, and a BNB Chain PancakeSwap swap tool that compares V2, V3 and WBNB/USDT-intermediated routes before approving and trading, with a one-click anti-MEV RPC entry for wallets.

English lives at `/`; Chinese lives at `/zh/`.

Swap links accept `?chain=bsc,bsc&token=<input>,<output>`, or the explicit
`inputchain` / `outputchain` / `inputtoken` / `outputtoken` keys. `bnb` and
`0x000…000` both mean native BNB.

**Live:** https://mhxw.github.io/tools/

## Development

```bash
pnpm install
pnpm dev    # http://localhost:3000/tools/
pnpm build  # static site in out/
```

Source code lives on `main`; the built site lives on `page`.

## License

MIT © 2026 MHXW
