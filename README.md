# Settlr 🧾🕶️

**Settlr** is a privacy-first invoicing protocol built on **Solana**. It combines the verifiability of on-chain invoices with the privacy of **Loyal's Private Transactions SDK** — letting freelancers issue transparent, auditable invoices while clients settle them through a shielded pool. The receipt is public. The payment trail is severed.

> The invoice is on-chain. The payment isn't.

---

## 🚀 Features

* **Verifiable Invoices, Invisible Payments:** Each invoice lives on-chain as a PDA — fully transparent, indexable, and provable. The actual USDC settlement is routed through Loyal's shielded pool, so no transfer ever links the freelancer and client wallets on the public ledger.
* **One-Click Pay Links:** Freelancers issue invoices and share a clean `settlr.app/invoice/<pda>` URL. Clients open the link, connect a wallet, and pay — no account, no signup.
* **Username Registry:** Issue invoices to `@handle` instead of raw pubkeys. Human-readable handles are owned and resolved on-chain via a Username PDA.
* **Dual-Sided Dashboard:** A `Sent` / `Received` tab view tracks every invoice you've issued or been billed for. Received invoices lazy-load to keep RPC usage minimal.
* **Private Balance & Claim Flow:** Paid funds land in a private balance first. Recipients explicitly **Claim** to pull them out to their standard SPL token account — keeping the inbound payment graph hidden until the moment of withdrawal.
* **PDF Receipt Export:** Every invoice is downloadable as a clean PDF receipt with the on-chain PDA reference embedded — perfect for accounting and tax records.

---

## 🛠 Tech Stack

* **On-chain Program:** Anchor (Rust), Solana Devnet
* **Frontend:** Next.js 16 (App Router), React, TypeScript, TailwindCSS, shadcn/ui
* **Wallet:** `@solana/wallet-adapter-react` + Phantom
* **Privacy SDK:** [`@loyal-labs/private-transactions`](https://docs.askloyal.com/sdk/private-transactions/quick-start)
* **Token:** USDC (SPL)
* **PDF Receipts:** jsPDF

---

## ⚙️ How It Works (The Privacy Model)

To get both verifiability *and* privacy on a public chain, Settlr separates the **contract** from the **settlement**:

```
┌─────────────┐                            ┌─────────────┐
│ Freelancer  │ ─── creates invoice PDA ──▶│   Solana    │
└─────────────┘                            │   (public)  │
                                            └─────────────┘
                                                  ▲
                                                  │ status: Paid
                                                  │
┌─────────────┐                            ┌─────────────┐
│   Client    │ ─── private payment ──────▶│    Loyal    │
└─────────────┘                            │   shielded  │
                                            │     pool    │
                                            └──────┬──────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │ Freelancer  │
                                            │  (claims)   │
                                            └─────────────┘
```

1. **Freelancer Creates an Invoice:** The Anchor program writes an `Invoice` PDA with `(freelancer, client, amount, description, deadline, status)`. Status starts as `Pending`. This receipt is fully public and verifiable.
2. **Freelancer Shares the Link:** A clean URL like `settlr.app/invoice/<pda>` — no off-chain database, the link *is* the on-chain reference.
3. **Client Pays via Loyal:** The Loyal SDK builds a private USDC transfer routed through a shielded pool (currently backed by Kamino reserves). The wallet-to-wallet transfer never appears on the public ledger.
4. **Anchor Flips Status to Paid:** Once the Loyal transfer confirms, the program's `pay_invoice` instruction updates the PDA's status. Critically, this instruction *does not move funds* — it's a pure state flip, so no public transfer leaks the relationship.
5. **Freelancer Claims:** Funds sit in the freelancer's private balance until they explicitly **Claim** them out to their wallet — keeping the inbound graph hidden until withdrawal.

The result: anyone can verify *this specific invoice* was paid. Nobody can scrape either wallet and reconstruct the payment graph.

---

## 🧩 On-Chain Program

**Program ID (devnet):** `DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC`

### Accounts
* **`Invoice`** — `(freelancer, client, amount, description, deadline, status, created_at, bump)`
* **`Username`** — optional human-readable handle owned by a wallet, derived as `[b"username", name]`

### Instructions
* `create_invoice(invoice_id, amount, description, deadline, client)` — freelancer issues an invoice
* `pay_invoice()` — client flips status to `Paid` after the Loyal private transfer confirms (does not move funds itself)
* `register_username(name)` — claim a `@handle` mapped to your wallet

### Events
`InvoiceCreated`, `InvoicePaid` — for indexers.

---

## 📁 Repository Layout

```
loyal_mini_hack/
├── settlr/                          # Anchor program
│   ├── programs/settlr/src/
│   │   ├── lib.rs
│   │   ├── instructions/            # create_invoice, pay_invoice, register_username
│   │   ├── state.rs                 # Invoice + Username accounts
│   │   ├── error.rs
│   │   └── constants.rs
│   └── tests/
└── client/                          # Next.js frontend
    ├── app/
    │   ├── page.tsx                 # Landing
    │   ├── create/page.tsx          # Issue an invoice
    │   ├── invoice/[pda]/page.tsx   # Pay / view (downloadable as PDF)
    │   └── dashboard/page.tsx       # Sent + Received tabs, claim balance
    ├── components/                  # PayButton, ClaimButton, UsernameRegisterCard
    └── lib/
        ├── anchor.ts                # Program client + PDA helpers
        ├── loyal.ts                 # Private payment wrapper
        └── pdf.ts                   # Invoice PDF generator
```

---

## 💻 Local Setup & Development

### 1. Requirements
* Node 20+ / Bun
* Rust + Solana CLI 1.18+
* Anchor 1.0.0
* A Solana wallet funded on devnet (a small amount of devnet SOL is enough for gas)

### 2. Anchor Program

Build, test, and deploy the on-chain program:

```bash
cd settlr
anchor build
anchor test                                    # local validator
anchor deploy --provider.cluster devnet        # devnet
```

After deploy, copy the generated IDL into the client:

```bash
cp target/idl/settlr.json ../client/lib/idl.json
```

### 3. Frontend

```bash
cd client
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

### 4. Environment Variables

Create a `.env.local` file inside `client/`:

```env
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

> For lower devnet rate limits, swap the RPC for a Helius or Alchemy devnet endpoint.

Navigate to `http://localhost:3000` to interact with the Settlr dashboard!

---

## 🏗 Usage Flow

### For Freelancers
1. Navigate to **Create Invoice**.
2. Connect your wallet (Solana Devnet).
3. Fill out the invoice form — client wallet (or `@handle`), amount, description, deadline.
4. Submit. Your invoice PDA is now live on-chain.
5. Copy the generated link and share it with your client.
6. Watch the **Sent** tab in your dashboard for status updates. Once paid, your private balance increases — click **Claim to Wallet** to withdraw.

### For Clients
1. Open the invoice link your freelancer shared.
2. Connect your wallet (with devnet USDC).
3. Click **Pay**. The Loyal SDK fires a private USDC transfer through the shielded pool.
4. Once confirmed, the Anchor program flips the invoice status to **Paid** on-chain.
5. Download a PDF receipt for your records.

---

## 🔍 Demo Flow

1. Connect Wallet A (freelancer) → `/create` → fill form → submit
2. Copy the invoice link
3. Connect Wallet B (client) in another browser → open the link → click **Pay**
4. Loyal SDK fires the private transfer; once confirmed, `pay_invoice` flips status to **Paid** on-chain
5. Wallet A's `/dashboard` shows the invoice as Paid; private balance increases; **Claim** moves funds to the wallet
6. Open Solana Explorer for both wallets — **no transaction between them exists**, but the invoice PDA shows `Paid`

That visual contradiction *is* the product.

---

## 🧠 Design Notes

### Why `pay_invoice` doesn't move funds
The Anchor instruction is purely a state flip. The actual USDC transfer happens through Loyal's SDK in a separate transaction. Bundling them would either (a) leak the payment by including a public transfer in the same tx, or (b) require Loyal to expose CPI surface. Decoupling them keeps the privacy guarantee intact and the program small.

### Compute footprint
A Loyal private payment runs ~95k CU end-to-end (mostly Kamino's `RedeemReserveCollateral` + ATA setup). The Settlr `pay_invoice` instruction itself is ~5–10k CU. Comfortably under the default 200k budget.

### Lazy-loaded received invoices
The dashboard fetches `Sent` invoices on mount (memcmp at offset 8) and only fires the `Received` query (memcmp at offset 40) when the user opens that tab. Keeps initial RPC budget at one `getProgramAccounts` call instead of two.

---

## 🚧 MVP Constraints

* USDC only (no multi-token support yet)
* No partial payments
* Devnet only

---

## 🏆 Built For

The **Loyal Mini Hack** — showcasing what becomes possible when you combine verifiable on-chain state with privacy-preserving settlement rails.
