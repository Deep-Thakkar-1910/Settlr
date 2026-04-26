"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ClaimCard } from "@/components/ClaimButton";
import { UsernameRegisterCard } from "@/components/UsernameRegisterCard";
import {
  fetchAllUsernames,
  fetchFreelancerInvoices,
  fetchUsernameByOwner,
  formatUsdc,
  getProgram,
  isInvoiceExpired,
  isInvoicePaid,
  truncatePubkey,
  type InvoiceAccount,
} from "@/lib/anchor";

function InvoiceRow({
  invoice,
  nameMap,
}: {
  invoice: InvoiceAccount;
  nameMap: Map<string, string>;
}) {
  const paid = isInvoicePaid(invoice.account.status);
  const expired = !paid && isInvoiceExpired(invoice.account.deadline);
  const pending = !paid && !expired;
  const deadlineDate = new Date(invoice.account.deadline.toNumber() * 1000);
  const clientKey = invoice.account.client.toBase58();
  const clientName = nameMap.get(clientKey);

  return (
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-white truncate">
          {invoice.account.description}
        </p>
        <p className="text-xs text-zinc-500 font-mono">
          {clientName ? `@${clientName}` : truncatePubkey(invoice.account.client)}
        </p>
      </div>
      <div className="text-right space-y-0.5 shrink-0">
        <p className="text-sm font-semibold text-white">
          ${formatUsdc(invoice.account.amount)}
        </p>
        <p className="text-xs text-zinc-600">{deadlineDate.toLocaleDateString()}</p>
      </div>
      <div className="shrink-0 w-20 flex justify-center">
        {paid && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            Paid
          </Badge>
        )}
        {expired && (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expired</Badge>
        )}
        {pending && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            Pending
          </Badge>
        )}
      </div>
      <div className="shrink-0">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-xs"
        >
          <Link href={`/invoice/${invoice.publicKey.toBase58()}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const [invoices, setInvoices] = useState<Array<InvoiceAccount>>([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!wallet || !publicKey) return;

    setLoading(true);
    const program = getProgram(wallet, connection);

    fetchUsernameByOwner(publicKey, program)
      .then((u) => setUsername(u?.account.name ?? null))
      .catch(() => setUsername(null));

    fetchFreelancerInvoices(publicKey, program)
      .then(async (results) => {
        const sorted = results.sort(
          (a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
        );
        setInvoices(sorted);
        try {
          const allNames = await fetchAllUsernames(program);
          const map = new Map<string, string>();
          for (const u of allNames) {
            map.set(u.account.owner.toBase58(), u.account.name);
          }
          setNameMap(map);
        } catch (e) {
          console.error("fetchAllUsernames failed", e);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet, publicKey, connection]);

  if (!publicKey) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Connect your wallet</CardTitle>
            <CardDescription className="text-zinc-400">
              Connect to view your invoices and private balance
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

  const pendingInvoices = invoices.filter(
    (inv) => !isInvoicePaid(inv.account.status) && !isInvoiceExpired(inv.account.deadline)
  );
  const paidInvoices = invoices.filter((inv) => isInvoicePaid(inv.account.status));
  const totalPendingUsdc = pendingInvoices.reduce(
    (sum, inv) => sum + inv.account.amount.toNumber(),
    0
  );

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-zinc-500 font-mono mt-0.5">
              {username ? `@${username}` : truncatePubkey(publicKey)}
            </p>
          </div>
          <Button asChild className="bg-white text-black hover:bg-zinc-200">
            <Link href="/create">+ New Invoice</Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">Total invoices</p>
              <p className="text-2xl font-bold text-white">{invoices.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{pendingInvoices.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">Pending value</p>
              <p className="text-2xl font-bold text-white">
                ${(totalPendingUsdc / 1_000_000).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        <UsernameRegisterCard onRegistered={setUsername} />

        <ClaimCard />

        <Separator className="bg-zinc-800" />

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-zinc-500 text-sm text-center py-6">Loading…</p>}

            {!loading && invoices.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <p className="text-zinc-500 text-sm">No invoices yet.</p>
                <Button asChild variant="outline" size="sm" className="border-zinc-700 text-zinc-400">
                  <Link href="/create">Create your first invoice</Link>
                </Button>
              </div>
            )}

            {!loading && invoices.length > 0 && (
              <div className="divide-y divide-zinc-800">
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.publicKey.toBase58()}
                    invoice={invoice}
                    nameMap={nameMap}
                  />
                ))}
              </div>
            )}

            {!loading && paidInvoices.length > 0 && (
              <p className="text-xs text-zinc-600 mt-4 text-center">
                {paidInvoices.length} invoice{paidInvoices.length !== 1 ? "s" : ""} paid privately
                via Loyal — no transaction links visible on-chain
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
