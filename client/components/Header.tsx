"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { truncatePubkey } from "@/lib/anchor";

function WalletButton() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected || !publicKey) {
    return (
      <Button
        onClick={() => setVisible(true)}
        variant="outline"
        size="sm"
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2"
      >
        <Wallet className="h-3.5 w-3.5" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2 font-mono"
        >
          <Wallet className="h-3.5 w-3.5" />
          {truncatePubkey(publicKey)}
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-zinc-900 border-zinc-800 text-zinc-300"
      >
        <DropdownMenuItem
          className="font-mono text-xs text-zinc-500 focus:bg-zinc-800 focus:text-zinc-300"
          onSelect={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(publicKey.toBase58());
          }}
        >
          {publicKey.toBase58().slice(0, 20)}…
          <span className="ml-1 text-zinc-600">(copy)</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem
          className="focus:bg-zinc-800 focus:text-red-400 text-red-400 gap-2 cursor-pointer"
          onSelect={() => disconnect()}
        >
          <LogOut className="h-3.5 w-3.5" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-white font-semibold tracking-tight hover:text-zinc-300 transition-colors"
        >
          Settlr
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/create"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Create
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
