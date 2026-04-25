import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatUsdc,
  isInvoiceExpired,
  isInvoicePaid,
  isInvoicePending,
  truncatePubkey,
  type InvoiceAccount,
} from "@/lib/anchor";

interface InvoiceCardProps {
  invoice: InvoiceAccount;
}

function StatusBadge({ invoice }: { invoice: InvoiceAccount }) {
  if (isInvoicePaid(invoice.account.status)) {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Paid</Badge>;
  }
  if (isInvoiceExpired(invoice.account.deadline)) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expired</Badge>;
  }
  return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
}

export function InvoiceCard({ invoice }: InvoiceCardProps) {
  const deadlineDate = new Date(invoice.account.deadline.toNumber() * 1000);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-white text-base font-medium leading-tight">
            {invoice.account.description}
          </CardTitle>
          <StatusBadge invoice={invoice} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-bold text-white">
          ${formatUsdc(invoice.account.amount)} USDC
        </div>
        <Separator className="bg-zinc-800" />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-zinc-500 text-xs mb-0.5">Client</p>
            <p className="text-zinc-300 font-mono">
              {truncatePubkey(invoice.account.client)}
            </p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-0.5">Deadline</p>
            <p className="text-zinc-300">{deadlineDate.toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
