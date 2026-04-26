"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import {
  fetchUsername,
  fetchUsernameByOwner,
  getProgram,
  isValidUsername,
  normalizeUsername,
} from "@/lib/anchor";
import { openSolscan, truncateSig } from "@/lib/explorer";

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Username is required")
    .refine((v) => isValidUsername(normalizeUsername(v)), {
      message: "3–32 chars, lowercase letters, digits, or underscores only",
    }),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  onRegistered?: (name: string) => void;
}

export function UsernameRegisterCard({ onRegistered }: Props) {
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const [hasUsername, setHasUsername] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (!wallet || !publicKey) return;
    const program = getProgram(wallet, connection);
    fetchUsernameByOwner(publicKey, program)
      .then((u) => setHasUsername(u !== null))
      .catch(() => setHasUsername(false));
  }, [wallet, publicKey, connection]);

  if (!wallet || !publicKey) return null;
  if (hasUsername === null) return null;
  if (hasUsername) return null;

  const onSubmit = async (values: FormValues) => {
    if (!wallet || !publicKey) return;
    setSubmitting(true);
    try {
      const normalized = normalizeUsername(values.name);
      const program = getProgram(wallet, connection);

      const existing = await fetchUsername(normalized, program);
      if (existing) {
        toast.error(`@${normalized} is already taken`);
        setSubmitting(false);
        return;
      }

      const sig = await program.methods
        .registerUsername(normalized)
        .accounts({ owner: publicKey })
        .rpc({ skipPreflight: true, commitment: "confirmed", maxRetries: 3 });

      toast.success("Username registered", {
        description: truncateSig(sig),
        action: { label: "View on Solscan", onClick: () => openSolscan(sig) },
        duration: 10000,
      });

      setHasUsername(true);
      onRegistered?.(normalized);
    } catch (error) {
      console.error(error);
      toast.error("Failed to register username. It may already be taken.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white text-base">Claim your username</CardTitle>
        <CardDescription className="text-zinc-400">
          Permanent on-chain handle. Once claimed, it&apos;s locked to this wallet forever.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex items-start gap-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="sr-only">Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@alice"
                      className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-zinc-600 text-xs">
                    3–32 chars, lowercase letters, digits, underscores
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={submitting}
              className="bg-white text-black hover:bg-zinc-200 shrink-0"
            >
              {submitting ? "Claiming…" : "Claim username"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
