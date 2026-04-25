"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function LandingPage() {
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (connected) router.replace("/dashboard");
  }, [connected, router]);

  if (connected) return null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="max-w-2xl space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-widest text-zinc-500 uppercase">
            Solana · Private Payments · USDC
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-white">Settlr</h1>
        </div>

        <Separator className="bg-zinc-800" />

        <p className="text-2xl font-semibold text-zinc-200">
          Verifiable invoicing.{" "}
          <span className="text-zinc-500">Invisible payments.</span>
        </p>

        <p className="text-zinc-400 leading-relaxed max-w-md mx-auto">
          Create on-chain invoices clients can verify and trust. Settle them
          privately — nobody can link the two wallets together via a transaction.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-white text-black hover:bg-zinc-200">
            <Link href="/create">Create Invoice</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          >
            <Link href="/dashboard">View Dashboard</Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-zinc-800">
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">On-chain proof</p>
            <p className="text-xs text-zinc-500">Invoice state fully verifiable on Solana</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">Private settlement</p>
            <p className="text-xs text-zinc-500">Payment trail severed by Loyal SDK</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">USDC native</p>
            <p className="text-xs text-zinc-500">Stable, instant, no conversion needed</p>
          </div>
        </div>
      </div>
    </main>
  );
}
