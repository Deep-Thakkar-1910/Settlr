"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClaimCard } from "@/components/ClaimButton";
import { UsernameRegisterCard } from "@/components/UsernameRegisterCard";
import {
  fetchAllUsernames,
  fetchClientInvoices,
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
  counterparty,
}: {
  invoice: InvoiceAccount;
  nameMap: Map<string, string>;
  counterparty: "client" | "freelancer";
}) {
  const paid = isInvoicePaid(invoice.account.status);
  const expired = !paid && isInvoiceExpired(invoice.account.deadline);
  const pending = !paid && !expired;
  const deadlineDate = new Date(invoice.account.deadline.toNumber() * 1000);
  const counterpartyKey =
    counterparty === "client" ? invoice.account.client : invoice.account.freelancer;
  const counterpartyName = nameMap.get(counterpartyKey.toBase58());

  return (
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-white truncate">
          {invoice.account.description}
        </p>
        <p className="text-xs text-zinc-500 font-mono">
          {counterpartyName ? `@${counterpartyName}` : truncatePubkey(counterpartyKey)}
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

  const [sentInvoices, setSentInvoices] = useState<Array<InvoiceAccount>>([]);
  const [receivedInvoices, setReceivedInvoices] = useState<Array<InvoiceAccount> | null>(null);
  const [loading, setLoading] = useState(false);
  const [receivedLoading, setReceivedLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!wallet || !publicKey) return;

    setLoading(true);
    setReceivedInvoices(null);
    const program = getProgram(wallet, connection);

    fetchUsernameByOwner(publicKey, program)
      .then((u) => setUsername(u?.account.name ?? null))
      .catch(() => setUsername(null));

    Promise.all([
      fetchFreelancerInvoices(publicKey, program),
      fetchAllUsernames(program).catch(() => []),
    ])
      .then(([sent, allNames]) => {
        const sortByCreated = (a: InvoiceAccount, b: InvoiceAccount) =>
          b.account.createdAt.toNumber() - a.account.createdAt.toNumber();
        setSentInvoices([...sent].sort(sortByCreated));
        const map = new Map<string, string>();
        for (const u of allNames) {
          map.set(u.account.owner.toBase58(), u.account.name);
        }
        setNameMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet, publicKey, connection]);

  const loadReceived = useCallback(async () => {
    if (!wallet || !publicKey) return;
    if (receivedInvoices !== null || receivedLoading) return;
    setReceivedLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const received = await fetchClientInvoices(publicKey, program);
      const sorted = [...received].sort(
        (a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
      );
      setReceivedInvoices(sorted);
    } catch (e) {
      console.error("fetchClientInvoices failed", e);
      setReceivedInvoices([]);
    } finally {
      setReceivedLoading(false);
    }
  }, [wallet, publicKey, connection, receivedInvoices, receivedLoading]);

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

  const pendingSent = sentInvoices.filter(
    (inv) => !isInvoicePaid(inv.account.status) && !isInvoiceExpired(inv.account.deadline)
  );
  const paidSent = sentInvoices.filter((inv) => isInvoicePaid(inv.account.status));
  const totalPendingUsdc = pendingSent.reduce(
    (sum, inv) => sum + inv.account.amount.toNumber(),
    0
  );
  const pendingReceived = (receivedInvoices ?? []).filter(
    (inv) => !isInvoicePaid(inv.account.status) && !isInvoiceExpired(inv.account.deadline)
  );
  const totalOwedUsdc = pendingReceived.reduce(
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">Sent</p>
              <p className="text-2xl font-bold text-white">{sentInvoices.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">Received</p>
              <p className="text-2xl font-bold text-white">
                {receivedInvoices === null ? "—" : receivedInvoices.length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">Owed to you</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${(totalPendingUsdc / 1_000_000).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-5">
              <p className="text-xs text-zinc-500 mb-1">You owe</p>
              <p className="text-2xl font-bold text-yellow-400">
                {receivedInvoices === null
                  ? "—"
                  : `$${(totalOwedUsdc / 1_000_000).toFixed(2)}`}
              </p>
            </CardContent>
          </Card>
        </div>

        <UsernameRegisterCard onRegistered={setUsername} />

        <ClaimCard />

        <Separator className="bg-zinc-800" />

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            {loading && <p className="text-zinc-500 text-sm text-center py-6">Loading…</p>}

            {!loading && (
              <Tabs
                defaultValue="sent"
                onValueChange={(v) => {
                  if (v === "received") void loadReceived();
                }}
              >
                <TabsList className="bg-zinc-950 border border-zinc-800">
                  <TabsTrigger value="sent" className="data-[state=active]:bg-zinc-800">
                    Sent ({sentInvoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="received" className="data-[state=active]:bg-zinc-800">
                    Received{receivedInvoices !== null ? ` (${receivedInvoices.length})` : ""}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sent" className="mt-4">
                  {sentInvoices.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-zinc-500 text-sm">No invoices sent yet.</p>
                      <Button asChild variant="outline" size="sm" className="border-zinc-700 text-zinc-400">
                        <Link href="/create">Create your first invoice</Link>
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-zinc-800">
                        {sentInvoices.map((invoice) => (
                          <InvoiceRow
                            key={invoice.publicKey.toBase58()}
                            invoice={invoice}
                            nameMap={nameMap}
                            counterparty="client"
                          />
                        ))}
                      </div>
                      {paidSent.length > 0 && (
                        <p className="text-xs text-zinc-600 mt-4 text-center">
                          {paidSent.length} invoice{paidSent.length !== 1 ? "s" : ""} paid privately
                          via Loyal — no transaction links visible on-chain
                        </p>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="received" className="mt-4">
                  {receivedLoading || receivedInvoices === null ? (
                    <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
                  ) : receivedInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-zinc-500 text-sm">
                        No invoices addressed to you yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {receivedInvoices.map((invoice) => (
                        <InvoiceRow
                          key={invoice.publicKey.toBase58()}
                          invoice={invoice}
                          nameMap={nameMap}
                          counterparty="freelancer"
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
