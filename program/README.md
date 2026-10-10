# SplitPay — Solana Program (Anchor)

On-chain program for SplitPay: expense groups, expenses and USDC debt
settlements as PDAs on Solana.

## Layout

```
program/
├── Anchor.toml                  # toolchain + cluster config (devnet by default)
├── programs/splitpay/           # the Anchor program (Rust)
│   └── src/
│       ├── lib.rs               # instruction routing
│       ├── errors.rs            # SplitpayError
│       ├── state/               # ExpenseGroup, Expense, Settlement accounts
│       └── instructions/        # one module per instruction
└── tests/splitpay.ts            # Anchor TS test suite (local validator)
```

## Accounts

| Account | PDA seeds | Notes |
|---|---|---|
| `ExpenseGroup` | `[b"splitpay-group", authority, group_id_le]` | `group_id` is a client-generated u64 nonce (LE bytes), so one wallet can own many groups |
| `Expense` | `[b"splitpay-expense", group, expense_id_le]` | `expense_id` is a client-generated u64 nonce (LE bytes), unique per group |
| `Settlement` | `[b"splitpay-settlement", from, to, group]` | one settlement account per (from, to, group) triple |

## Instructions

- `create_group(group_id, name)` — creates a group; creator becomes first member
- `add_member(group_id, member)` / `remove_member(group_id, member)` — authority only
- `close_group(group_id)` — authority only; reclaims rent
- `add_expense(group_id, expense_id, amount, description)` — group members only; accumulates `total_spent`
- `create_settlement(group_id, amount)` — member → member settlement request (Pending)
- `complete_settlement()` — payer signs; CPI SPL `transfer_checked` of `amount` USDC from payer ATA to recipient ATA; marks Completed
- `dispute_settlement()` — from or to; Pending → Disputed

## Prerequisites (WSL2 — native Windows is not supported by the Solana toolchain)

Inside WSL2 (Ubuntu):

```bash
# 1. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# 2. Solana CLI (use the Agave installer)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version

# 3. Anchor CLI (0.31.x) — via avm
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.31.1
avm use 0.31.1
anchor --version   # should print anchor-cli 0.31.1

# 4. Node + Yarn (for the TS tests)
#    e.g. via nvm, then: npm install -g yarn
```

## Build & test

```bash
cd program/
yarn install          # install TS test dependencies
anchor build
anchor keys sync      # IMPORTANT: replaces the placeholder program id
                      # (Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS)
                      # in lib.rs / Anchor.toml with the real keypair pubkey
anchor test           # spins up solana-test-validator and runs tests/splitpay.ts
```

The USDC transfer test creates a local test mint (6 decimals) because real
USDC does not exist on the local validator. On devnet use the official devnet
USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
(mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).

## Deploy to devnet

```bash
solana config set --url https://api.devnet.solana.com
solana-keygen new        # if you don't have a wallet yet
solana airdrop 2         # fund the deployer wallet
anchor deploy --provider.cluster devnet
```

## Wiring the Program ID into the app

After `anchor deploy`, copy the program id:

```bash
solana address -k target/deploy/splitpay-keypair.json
```

and paste it into the **repository root** `.env`:

```
SPLITPAY_PROGRAM_ID=<the program id>
```

(see `.env.example`). Make sure the same id appears in
`declare_id!` in `programs/splitpay/src/lib.rs` and in `Anchor.toml`
(`anchor keys sync` keeps these in sync after the first build).
