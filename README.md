# tempo-x402-demo

Interactive demo of the [tempo-x402](https://github.com/compusophy/tempo-x402) payment protocol.

Demonstrates the HTTP 402 Payment Required flow on the Tempo blockchain:
1. Request a protected endpoint
2. Receive 402 response with payment requirements
3. Sign an EIP-712 payment authorization
4. Retry with `PAYMENT-SIGNATURE` header
5. Receive the paid response + settlement transaction

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## How it works

- **Demo Key mode** (default): Uses a pre-funded testnet wallet. No setup required.
- **Browser Wallet mode**: Connect MetaMask or any EIP-1193 wallet. Must have pathUSD on Tempo Moderato and have approved the facilitator.

## Stack

- Next.js 16
- viem for EIP-712 signing
- Tailwind CSS
- Points at deployed Railway services

## Links

- [tempo-x402 crate](https://crates.io/crates/tempo-x402)
- [GitHub](https://github.com/compusophy/tempo-x402)
- [Tempo Moderato Explorer](https://explore.moderato.tempo.xyz)

## Chain

- Network: Tempo Moderato (testnet)
- Chain ID: 42431
- Token: pathUSD (6 decimals)
- RPC: https://rpc.moderato.tempo.xyz
