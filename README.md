# Tools

A small static toolbox for on-chain and web utilities: multi-chain EIP-7702 checks, Safe multisig inspection, transaction inspection, domain security checks (DNS, DNSSEC, SPF, DMARC), and a frontend stack detector that identifies frameworks and versions, compares them with the latest npm releases, and checks OSV for known vulnerabilities.

English lives at `/`; Chinese lives at `/zh/`.

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
