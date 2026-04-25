import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "./idl.json";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC"
);

const INVOICE_SEED = Buffer.from("invoice");

export type InvoiceStatus = { pending: Record<string, never> } | { paid: Record<string, never> };

export interface InvoiceAccount {
  publicKey: PublicKey;
  account: {
    freelancer: PublicKey;
    client: PublicKey;
    amount: BN;
    description: string;
    deadline: BN;
    status: InvoiceStatus;
    createdAt: BN;
    bump: number;
  };
}

export function getProgram(wallet: AnchorWallet, connection: Connection): Program {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idlJson as Idl, provider);
}

export function deriveInvoicePda(freelancer: PublicKey, invoiceId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INVOICE_SEED, freelancer.toBuffer(), invoiceId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

// Anchor converts IDL names to camelCase at runtime: "Invoice" → "invoice"
function invoiceAccountClient(program: Program) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (program.account as any).invoice;
}

export async function fetchInvoice(pda: PublicKey, program: Program): Promise<InvoiceAccount> {
  const account = await invoiceAccountClient(program).fetch(pda);
  return { publicKey: pda, account: account as InvoiceAccount["account"] };
}

export async function fetchFreelancerInvoices(
  freelancer: PublicKey,
  program: Program
): Promise<Array<InvoiceAccount>> {
  const accounts = await invoiceAccountClient(program).all([
    {
      memcmp: {
        offset: 8, // skip 8-byte discriminator; freelancer pubkey is the first field
        bytes: freelancer.toBase58(),
      },
    },
  ]);
  return accounts.map(
    (item: { publicKey: PublicKey; account: InvoiceAccount["account"] }) => ({
      publicKey: item.publicKey,
      account: item.account,
    })
  );
}

export async function getNextInvoiceId(freelancer: PublicKey, program: Program): Promise<BN> {
  const invoices = await fetchFreelancerInvoices(freelancer, program);
  return new BN(invoices.length);
}

export function isInvoicePending(status: InvoiceStatus): boolean {
  return "pending" in status;
}

export function isInvoicePaid(status: InvoiceStatus): boolean {
  return "paid" in status;
}

export function isInvoiceExpired(deadline: BN): boolean {
  return deadline.toNumber() < Math.floor(Date.now() / 1000);
}

export function formatUsdc(lamports: BN): string {
  const usdc = lamports.toNumber() / 1_000_000;
  return usdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function truncatePubkey(pubkey: PublicKey | string): string {
  const str = pubkey.toString();
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}
