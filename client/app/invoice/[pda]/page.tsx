"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PayButton } from "@/components/PayButton";
import {
  fetchInvoice,
  formatUsdc,
  getProgram,
  isInvoiceExpired,
  isInvoicePaid,
  isInvoicePending,
  truncatePubkey,
  type InvoiceAccount,
} from "@/lib/anchor";
import { use } from "react";

interface Params {
  pda: string;
}

export default function InvoicePage({ params }: { params: Promise<Params> }) {
  const { pda } = use(params);

  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const [invoice, setInvoice] = useState<InvoiceAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const pdaPubkey = new PublicKey(pda);
      const program = getProgram(wallet, connection);
      const loaded = await fetchInvoice(pdaPubkey, program);
      setInvoice(loaded);
    } catch {
      setError("Invoice not found or could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, pda]);

  useEffect(() => {
    if (wallet) loadInvoice();
  }, [wallet, loadInvoice]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Invoice link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!publicKey) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Connect your wallet</CardTitle>
            <CardDescription className="text-zinc-400">
              Connect to view and pay this invoice
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              onClick={() => setVisible(true)}
              className="bg-white text-black hover:bg-zinc-200"
            >
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <p className="text-zinc-400">Loading invoice…</p>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <p className="text-red-400">{error ?? "Invoice not found."}</p>
      </main>
    );
  }

  const invoicePda = new PublicKey(pda);
  const deadlineDate = new Date(invoice.account.deadline.toNumber() * 1000);
  const createdDate = new Date(invoice.account.createdAt.toNumber() * 1000);
  const expired = isInvoiceExpired(invoice.account.deadline);
  const paid = isInvoicePaid(invoice.account.status);
  const pending = isInvoicePending(invoice.account.status);
  const isClient = publicKey.equals(invoice.account.client);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Invoice</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-900"
          >
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-white text-lg font-semibold">
                {invoice.account.description}
              </CardTitle>
              {paid && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                  Paid
                </Badge>
              )}
              {!paid && expired && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 shrink-0">
                  Expired
                </Badge>
              )}
              {pending && !expired && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shrink-0">
                  Pending
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold text-white">
              ${formatUsdc(invoice.account.amount)}{" "}
              <span className="text-lg text-zinc-400 font-normal">USDC</span>
            </div>

            <Separator className="bg-zinc-800" />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500 text-xs mb-1">From (freelancer)</p>
                <p className="text-zinc-300 font-mono text-xs break-all">
                  {truncatePubkey(invoice.account.freelancer)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">To (client)</p>
                <p className="text-zinc-300 font-mono text-xs break-all">
                  {truncatePubkey(invoice.account.client)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Deadline</p>
                <p className={`text-xs ${expired ? "text-red-400" : "text-zinc-300"}`}>
                  {deadlineDate.toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Created</p>
                <p className="text-zinc-300 text-xs">{createdDate.toLocaleDateString()}</p>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            <div>
              <p className="text-zinc-500 text-xs mb-1">Invoice PDA</p>
              <p className="text-zinc-600 font-mono text-xs break-all">{pda}</p>
            </div>
          </CardContent>
        </Card>

        {paid && (
          <Card className="bg-emerald-950/30 border-emerald-800/40">
            <CardContent className="pt-5 text-center">
              <p className="text-emerald-400 font-semibold">Invoice Settled</p>
              <p className="text-zinc-500 text-sm mt-1">
                Payment was processed privately via Loyal
              </p>
            </CardContent>
          </Card>
        )}

        {pending && !expired && isClient && (
          <PayButton
            invoice={invoice}
            invoicePda={invoicePda}
            onPaid={loadInvoice}
          />
        )}

        {pending && !expired && !isClient && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5 text-center">
              <p className="text-zinc-400 text-sm">
                This invoice is not addressed to your wallet.
              </p>
              <p className="text-zinc-600 text-xs mt-1">
                Connect the client wallet ({truncatePubkey(invoice.account.client)}) to pay.
              </p>
            </CardContent>
          </Card>
        )}

        {expired && !paid && (
          <Card className="bg-red-950/30 border-red-800/40">
            <CardContent className="pt-5 text-center">
              <p className="text-red-400 font-semibold">Invoice Expired</p>
              <p className="text-zinc-500 text-sm mt-1">The payment deadline has passed.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
