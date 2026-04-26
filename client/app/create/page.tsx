"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  deriveInvoicePda,
  fetchUsername,
  getNextInvoiceId,
  getProgram,
  normalizeUsername,
  truncatePubkey,
} from "@/lib/anchor";
import { openSolscan, truncateSig } from "@/lib/explorer";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  clientAddress: z.string().refine(
    (val) => {
      const trimmed = val.trim();
      if (/^@?[a-z0-9_]{3,32}$/.test(trimmed)) return true;
      try {
        new PublicKey(trimmed);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Enter a valid Solana pubkey or @username" }
  ),
  amountUsdc: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be greater than zero",
    }),
  description: z
    .string()
    .min(1, "Description is required")
    .max(200, "Max 200 characters"),
  deadline: z
    .date({ message: "Pick a deadline date" })
    .refine((date) => date > new Date(), { message: "Deadline must be in the future" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateInvoicePage() {
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState<{ pubkey: PublicKey; via: "username" | "pubkey" } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientAddress: "",
      amountUsdc: "",
      description: "",
    },
  });

  const clientAddressValue = form.watch("clientAddress");
  const usernameLikeRe = useMemo(() => /^@?[a-z0-9_]{3,32}$/, []);

  useEffect(() => {
    const raw = (clientAddressValue ?? "").trim();
    setResolveError(null);

    if (raw === "") {
      setResolved(null);
      setResolving(false);
      return;
    }

    if (usernameLikeRe.test(raw)) {
      if (!wallet) {
        setResolved(null);
        return;
      }
      setResolving(true);
      const normalized = normalizeUsername(raw);
      const handle = setTimeout(async () => {
        try {
          const program = getProgram(wallet, connection);
          const found = await fetchUsername(normalized, program);
          if (found) {
            setResolved({ pubkey: found.account.owner, via: "username" });
            setResolveError(null);
          } else {
            setResolved(null);
            setResolveError(`No wallet registered as @${normalized}`);
          }
        } catch {
          setResolved(null);
          setResolveError("Lookup failed");
        } finally {
          setResolving(false);
        }
      }, 300);
      return () => clearTimeout(handle);
    }

    try {
      const pk = new PublicKey(raw);
      setResolved({ pubkey: pk, via: "pubkey" });
      setResolving(false);
    } catch {
      setResolved(null);
      setResolving(false);
    }
  }, [clientAddressValue, wallet, connection, usernameLikeRe]);

  const onSubmit = async (values: FormValues) => {
    if (!wallet || !publicKey) return;
    if (!resolved) {
      toast.error("Recipient could not be resolved");
      return;
    }
    setSubmitting(true);
    try {
      const program = getProgram(wallet, connection);
      const invoiceId = await getNextInvoiceId(publicKey, program);
      const [invoicePda] = deriveInvoicePda(publicKey, invoiceId);

      const sig = await program.methods
        .createInvoice(
          invoiceId,
          new BN(Math.round(parseFloat(values.amountUsdc) * 1_000_000)),
          values.description,
          new BN(Math.floor(values.deadline.getTime() / 1000)),
          resolved.pubkey
        )
        .accounts({ freelancer: publicKey })
        .rpc({ skipPreflight: true, commitment: "confirmed", maxRetries: 3 });

      toast.success("Invoice created on-chain", {
        description: truncateSig(sig),
        action: { label: "View on Solscan", onClick: () => openSolscan(sig) },
        duration: 10000,
      });
      router.push(`/invoice/${invoicePda.toBase58()}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create invoice. Check console for details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!publicKey) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Connect your wallet</CardTitle>
            <CardDescription className="text-zinc-400">
              You need a connected wallet to create an invoice
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

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">New Invoice</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Invoice will be stored on-chain as a Solana PDA
          </p>
        </div>

        <Separator className="bg-zinc-800" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="clientAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Client wallet or @username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@alice or Solana public key"
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  {resolving && (
                    <FormDescription className="text-zinc-500 text-xs">
                      Looking up {field.value.trim()}…
                    </FormDescription>
                  )}
                  {!resolving && resolved && resolved.via === "username" && (
                    <FormDescription className="text-emerald-400 text-xs font-mono">
                      Resolves to: {truncatePubkey(resolved.pubkey)}
                    </FormDescription>
                  )}
                  {!resolving && resolved && resolved.via === "pubkey" && (
                    <FormDescription className="text-zinc-500 text-xs font-mono">
                      Pubkey: {truncatePubkey(resolved.pubkey)}
                    </FormDescription>
                  )}
                  {!resolving && resolveError && (
                    <FormDescription className="text-red-400 text-xs">
                      {resolveError}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amountUsdc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Amount (USDC)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 500.00"
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">
                    Description
                    <span className="ml-2 text-zinc-600 font-normal text-xs">
                      ({field.value?.length ?? 0}/200)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What is this invoice for?"
                      maxLength={200}
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-zinc-600 text-xs">
                    Stored on-chain — keep it professional
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Payment deadline</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-zinc-900 border-zinc-700 hover:bg-zinc-800",
                            !field.value && "text-zinc-600"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                          {field.value ? (
                            <span className="text-white">{format(field.value, "PPP")}</span>
                          ) : (
                            "Pick a date"
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 bg-zinc-900 border-zinc-800"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date <= new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={submitting || resolving || !resolved}
              className="w-full bg-white text-black hover:bg-zinc-200 font-semibold"
            >
              {submitting ? "Creating invoice…" : "Create Invoice"}
            </Button>
          </form>
        </Form>
      </div>
    </main>
  );
}
