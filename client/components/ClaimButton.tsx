"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { openSolscan, truncateSig } from "@/lib/explorer";
import {
  claimPrivateDeposit,
  getClaimableBalance,
  type LoyalWallet,
} from "@/lib/loyal";

function formatLamports(lamports: bigint): string {
  const usdc = Number(lamports) / 1_000_000;
  return usdc.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ClaimCard() {
  const wallet = useAnchorWallet();
  const { signMessage } = useWallet();
  const { connection } = useConnection();

  const [balance, setBalance] = useState<bigint | null>(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const inFlightRef = useRef(false);

  const buildLoyalWallet = useCallback((): LoyalWallet | null => {
    if (!wallet || !signMessage) return null;
    return {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction.bind(wallet),
      signAllTransactions: wallet.signAllTransactions.bind(wallet),
      signMessage,
    };
  }, [wallet, signMessage]);

  const refresh = useCallback(async () => {
    const loyalWallet = buildLoyalWallet();
    if (!loyalWallet) return;
    setChecking(true);
    try {
      const value = await getClaimableBalance({ wallet: loyalWallet, connection });
      setBalance(value);
    } catch (error) {
      console.error("Failed to read claimable balance", error);
      toast.error("Could not read private balance");
      setBalance(BigInt(0));
    } finally {
      setChecking(false);
    }
  }, [buildLoyalWallet, connection]);

  const handleClaim = async () => {
    const loyalWallet = buildLoyalWallet();
    if (!loyalWallet || inFlightRef.current) return;
    inFlightRef.current = true;
    setClaiming(true);
    const toastId = toast.loading("Settling private balance to your wallet…");
    try {
      const sig = await claimPrivateDeposit({ wallet: loyalWallet, connection });
      console.log("Claim signature:", sig);
      toast.success("Claimed to wallet", {
        id: toastId,
        description: truncateSig(sig),
        action: { label: "View on Solscan", onClick: () => openSolscan(sig) },
        duration: 10000,
      });
      await refresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Claim failed";
      toast.error(message, { id: toastId });
    } finally {
      inFlightRef.current = false;
      setClaiming(false);
    }
  };

  const hasBalance = balance !== null && balance > BigInt(0);
  const balanceLoaded = balance !== null;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 mb-1">Private balance (USDC)</p>
          <p className="text-2xl font-bold text-white">
            {balanceLoaded ? `$${formatLamports(balance)}` : "—"}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            {balanceLoaded
              ? "Funds received privately via Loyal. Claim to move them into your wallet."
              : "Sign once to view your private balance (one-time prompt per month)."}
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-2">
          {balanceLoaded ? (
            <Button
              onClick={handleClaim}
              disabled={!hasBalance || claiming || checking}
              className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
            >
              {claiming ? "Claiming…" : "Claim to wallet"}
            </Button>
          ) : (
            <Button
              onClick={refresh}
              disabled={checking}
              className="bg-white text-black hover:bg-zinc-200 font-semibold"
            >
              {checking ? "Loading…" : "Check balance"}
            </Button>
          )}
          {balanceLoaded && (
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={checking || claiming}
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-xs"
            >
              {checking ? "Refreshing…" : "Refresh"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
