import {
  ER_VALIDATOR_DEVNET,
  findDepositPda,
  LoyalPrivateTransactionsClient,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@loyal-labs/private-transactions";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

const EPHEMERAL_RPC_DEVNET = "https://tee.magicblock.app";
const EPHEMERAL_WS_DEVNET = "wss://tee.magicblock.app";

const SKIP = { skipPreflight: true } as const;

export interface LoyalWallet {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface PrivatePaymentParams {
  senderWallet: LoyalWallet;
  recipientPubkey: PublicKey;
  amountUsdc: number;
  connection: Connection;
}

// ---------------------------------------------------------------------------
// PER auth token + client caching
// ---------------------------------------------------------------------------
// `LoyalPrivateTransactionsClient.fromConfig` issues a signMessage prompt to
// acquire the PER auth token unless one is supplied. Tokens are valid for
// 30 days, so we cache them in localStorage and reuse the same client across
// the session — turning N popups into 1 (per month).

interface CachedAuthToken {
  token: string;
  expiresAt: number;
}

function authStorageKey(pubkey: PublicKey): string {
  return `loyal:authToken:${EPHEMERAL_RPC_DEVNET}:${pubkey.toBase58()}`;
}

function readCachedAuthToken(pubkey: PublicKey): CachedAuthToken | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(authStorageKey(pubkey));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedAuthToken;
    if (!parsed?.token || !parsed?.expiresAt) return undefined;
    // Refresh a few minutes early to avoid races against expiry.
    if (parsed.expiresAt < Date.now() + 5 * 60 * 1000) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeCachedAuthToken(pubkey: PublicKey, token: CachedAuthToken): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(authStorageKey(pubkey), JSON.stringify(token));
  } catch {
    // ignore quota / disabled storage
  }
}

interface ClientCacheEntry {
  client: LoyalPrivateTransactionsClient;
  rpcEndpoint: string;
  pubkey: string;
}

let clientCache: ClientCacheEntry | null = null;

async function getClient(
  wallet: LoyalWallet,
  connection: Connection,
): Promise<LoyalPrivateTransactionsClient> {
  const pubkey = wallet.publicKey.toBase58();
  if (
    clientCache &&
    clientCache.pubkey === pubkey &&
    clientCache.rpcEndpoint === connection.rpcEndpoint
  ) {
    return clientCache.client;
  }

  const cachedToken = readCachedAuthToken(wallet.publicKey);

  const client = await LoyalPrivateTransactionsClient.fromConfig({
    signer: wallet,
    baseRpcEndpoint: connection.rpcEndpoint,
    ephemeralRpcEndpoint: EPHEMERAL_RPC_DEVNET,
    ephemeralWsEndpoint: EPHEMERAL_WS_DEVNET,
    commitment: "confirmed",
    authToken: cachedToken,
  });

  // If the SDK had to acquire a fresh token, persist it so the next session
  // (or page refresh) doesn't re-prompt. The SDK doesn't return the token
  // directly, so we re-extract it from the ephemeral RPC URL it built.
  if (!cachedToken) {
    try {
      const ephEndpoint = (
        client.getEphemeralProgram().provider as { connection: Connection }
      ).connection.rpcEndpoint;
      const url = new URL(ephEndpoint);
      const token = url.searchParams.get("token");
      if (token) {
        writeCachedAuthToken(wallet.publicKey, {
          token,
          // 30-day session per Loyal SDK; refresh a day early to be safe.
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 29,
        });
      }
    } catch {
      // ignore — caching is a best-effort optimization
    }
  }

  clientCache = { client, rpcEndpoint: connection.rpcEndpoint, pubkey };
  return client;
}

export function clearLoyalAuthCache(pubkey?: PublicKey): void {
  clientCache = null;
  if (typeof window === "undefined") return;
  if (pubkey) {
    window.localStorage.removeItem(authStorageKey(pubkey));
    return;
  }
  // Clear all loyal:authToken:* keys
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("loyal:authToken:")) {
      window.localStorage.removeItem(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isDelegated(
  client: LoyalPrivateTransactionsClient,
  account: PublicKey,
): Promise<boolean> {
  try {
    const status = await client.getAccountDelegationStatus(account);
    return status.result?.isDelegated ?? false;
  } catch {
    // TEE returns errors for accounts that don't exist or aren't tracked yet.
    return false;
  }
}

async function setupDepositForPer(
  client: LoyalPrivateTransactionsClient,
  user: PublicKey,
  payer: PublicKey,
  tokenMint: PublicKey,
): Promise<void> {
  const [depositPda] = findDepositPda(user, tokenMint);

  const existingDeposit = await client.getBaseDeposit(user, tokenMint);
  if (!existingDeposit) {
    await client.initializeDeposit({ tokenMint, user, payer, rpcOptions: SKIP });
  }

  if (!(await isDelegated(client, depositPda))) {
    await client.createPermission({ tokenMint, user, payer, rpcOptions: SKIP });
    await client.delegateDeposit({
      tokenMint,
      user,
      payer,
      validator: ER_VALIDATOR_DEVNET,
      rpcOptions: SKIP,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type PrivatePaymentStage =
  | "auth"
  | "shielding"
  | "preparing-recipient"
  | "transferring";

export interface SendPrivatePaymentOptions extends PrivatePaymentParams {
  onStage?: (stage: PrivatePaymentStage) => void;
}

/**
 * Executes a private USDC transfer using the Loyal SDK:
 *
 * 1. Shields sender's USDC into the Private Ephemeral Rollup (PER)
 * 2. Ensures recipient's deposit account is also delegated to PER
 * 3. Transfers within PER — no on-chain link between the two wallets
 */
export async function sendPrivatePayment({
  senderWallet,
  recipientPubkey,
  amountUsdc,
  connection,
  onStage,
}: SendPrivatePaymentOptions): Promise<string> {
  const tokenMint = USDC_MINT_DEVNET;
  const user = senderWallet.publicKey;
  const amountLamports = Math.round(amountUsdc * 1_000_000);

  onStage?.("auth");
  const client = await getClient(senderWallet, connection);

  // --- Sender setup ---
  onStage?.("shielding");
  const [senderDepositPda] = findDepositPda(user, tokenMint);
  const senderIsDelegated = await isDelegated(client, senderDepositPda);

  if (senderIsDelegated) {
    // Already in PER — make sure ephemeral balance covers the transfer.
    const ephemeralDeposit = await client.getEphemeralDeposit(user, tokenMint);
    const ephemeralBalance = ephemeralDeposit ? Number(ephemeralDeposit.amount) : 0;

    if (ephemeralBalance < amountLamports) {
      // Pull account back to base layer, shield the deficit, then re-delegate.
      await client.undelegateDeposit({
        tokenMint,
        user,
        payer: user,
        sessionToken: null,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
        rpcOptions: SKIP,
      });

      const deficit = amountLamports - ephemeralBalance;
      const userTokenAccount = getAssociatedTokenAddressSync(tokenMint, user);
      await client.modifyBalance({
        tokenMint,
        user,
        payer: user,
        amount: deficit,
        increase: true,
        userTokenAccount,
        rpcOptions: SKIP,
      });

      await client.createPermission({ tokenMint, user, payer: user, rpcOptions: SKIP });
      await client.delegateDeposit({
        tokenMint,
        user,
        payer: user,
        validator: ER_VALIDATOR_DEVNET,
        rpcOptions: SKIP,
      });
    }
  } else {
    // First time: initialize deposit, shield USDC, delegate.
    const existingSenderDeposit = await client.getBaseDeposit(user, tokenMint);
    if (!existingSenderDeposit) {
      await client.initializeDeposit({ tokenMint, user, payer: user, rpcOptions: SKIP });
    }

    const alreadyShielded = existingSenderDeposit ? Number(existingSenderDeposit.amount) : 0;
    const toShield = amountLamports - alreadyShielded;
    if (toShield > 0) {
      const userTokenAccount = getAssociatedTokenAddressSync(tokenMint, user);
      await client.modifyBalance({
        tokenMint,
        user,
        payer: user,
        amount: toShield,
        increase: true,
        userTokenAccount,
        rpcOptions: SKIP,
      });
    }

    await client.createPermission({ tokenMint, user, payer: user, rpcOptions: SKIP });
    await client.delegateDeposit({
      tokenMint,
      user,
      payer: user,
      validator: ER_VALIDATOR_DEVNET,
      rpcOptions: SKIP,
    });
  }

  // --- Recipient: initialize + delegate so they can receive in PER ---
  onStage?.("preparing-recipient");
  await setupDepositForPer(client, recipientPubkey, user, tokenMint);

  // --- Private transfer inside PER ---
  onStage?.("transferring");
  const signature = await client.transferDeposit({
    tokenMint,
    user,
    destinationUser: recipientPubkey,
    amount: amountLamports,
    payer: user,
    sessionToken: null,
    rpcOptions: SKIP,
  });

  return signature;
}

/**
 * Reads the user's claimable USDC balance — the amount sitting in their
 * private deposit (delegated → check ephemeral; otherwise → check base).
 * Returns lamports (USDC has 6 decimals).
 *
 * Note: this triggers a one-time signMessage prompt per 30-day session so
 * the SDK can acquire a PER auth token; subsequent calls are silent.
 */
export async function getClaimableBalance({
  wallet,
  connection,
}: {
  wallet: LoyalWallet;
  connection: Connection;
}): Promise<bigint> {
  const tokenMint = USDC_MINT_DEVNET;
  const user = wallet.publicKey;
  const client = await getClient(wallet, connection);

  const [depositPda] = findDepositPda(user, tokenMint);
  if (await isDelegated(client, depositPda)) {
    const ephemeral = await client.getEphemeralDeposit(user, tokenMint);
    return ephemeral ? BigInt(ephemeral.amount.toString()) : BigInt(0);
  }
  const base = await client.getBaseDeposit(user, tokenMint);
  return base ? BigInt(base.amount.toString()) : BigInt(0);
}

/**
 * Pulls the recipient's full private deposit back to their wallet ATA.
 *
 * If delegated, undelegate first (which commits PER state into the base
 * deposit); then withdraw the full base-deposit amount via modifyBalance.
 */
export async function claimPrivateDeposit({
  wallet,
  connection,
}: {
  wallet: LoyalWallet;
  connection: Connection;
}): Promise<string> {
  const tokenMint = USDC_MINT_DEVNET;
  const user = wallet.publicKey;
  const client = await getClient(wallet, connection);

  const [depositPda] = findDepositPda(user, tokenMint);
  const userTokenAccount = getAssociatedTokenAddressSync(tokenMint, user);

  if (await isDelegated(client, depositPda)) {
    await client.undelegateDeposit({
      tokenMint,
      user,
      payer: user,
      sessionToken: null,
      magicProgram: MAGIC_PROGRAM_ID,
      magicContext: MAGIC_CONTEXT_ID,
      rpcOptions: SKIP,
    });
  }

  const baseDeposit = await client.getBaseDeposit(user, tokenMint);
  const claimable = baseDeposit ? BigInt(baseDeposit.amount.toString()) : BigInt(0);
  if (claimable === BigInt(0)) {
    throw new Error("Nothing to claim");
  }

  const result = await client.modifyBalance({
    tokenMint,
    user,
    payer: user,
    amount: claimable,
    increase: false,
    userTokenAccount,
    rpcOptions: SKIP,
  });

  return result.signature;
}
