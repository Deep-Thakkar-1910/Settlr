"use client";

import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatUsdc, getProgram, type InvoiceAccount } from "@/lib/anchor";
import { openSolscan, truncateSig } from "@/lib/explorer";
import {
  sendPrivatePayment,
  type LoyalWallet,
  type PrivatePaymentStage,
} from "@/lib/loyal";

interface PayButtonProps {
  invoice: InvoiceAccount;
  invoicePda: PublicKey;
  onPaid: () => void;
}

const STAGE_TOAST: Record<PrivatePaymentStage, string> = {
  auth: "Connecting to Loyal private layer…",
  shielding: "Shielding USDC into the private layer…",
  "preparing-recipient": "Preparing recipient deposit…",
  transferring: "Sending private transfer…",
};

export function PayButton({ invoice, invoicePda, onPaid }: PayButtonProps) {
  const wallet = useAnchorWallet();
  const { signMessage } = useWallet();
  const { connection } = useConnection();
  const [paying, setPaying] = useState(false);
  const inFlightRef = useRef(false);

  const handlePay = async () => {
    if (!wallet || !signMessage || inFlightRef.current) return;
    inFlightRef.current = true;
    setPaying(true);

    const toastId = toast.loading("Preparing private payment…");

    try {
      const loyalWallet: LoyalWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction.bind(wallet),
        signAllTransactions: wallet.signAllTransactions.bind(wallet),
        signMessage,
      };

      // Step 1: Private transfer via Loyal SDK (severs the on-chain link)
      const transferSig = await sendPrivatePayment({
        senderWallet: loyalWallet,
        recipientPubkey: invoice.account.freelancer,
        amountUsdc: invoice.account.amount.toNumber() / 1_000_000,
        connection,
        onStage: (stage) => toast.loading(STAGE_TOAST[stage], { id: toastId }),
      });
      console.log("Loyal private transfer signature:", transferSig);

      // Step 2: Flip invoice status on-chain. Use skipPreflight to avoid a
      // Phantom simulation race that surfaces as "transaction already
      // processed" when the wallet and provider both probe the network.
      toast.loading("Confirming invoice on-chain…", { id: toastId });
      const program = getProgram(wallet, connection);
      const sig = await program.methods
        .payInvoice()
        .accounts({ invoice: invoicePda, client: wallet.publicKey })
        .rpc({ skipPreflight: true, commitment: "confirmed", maxRetries: 3 });
      console.log("payInvoice signature:", sig);

      toast.success("Invoice settled privately", {
        id: toastId,
        description: truncateSig(sig),
        action: { label: "View on Solscan", onClick: () => openSolscan(sig) },
        duration: 10000,
      });
      onPaid();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Payment failed.";
      toast.error(message, { id: toastId });
    } finally {
      inFlightRef.current = false;
      setPaying(false);
    }
  };

  return (
    <Button
      onClick={handlePay}
      disabled={paying}
      size="lg"
      className="w-full bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
    >
      {paying
        ? "Processing…"
        : `Pay $${formatUsdc(invoice.account.amount)} USDC (private)`}
    </Button>
  );
}
