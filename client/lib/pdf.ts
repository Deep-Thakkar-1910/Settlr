import jsPDF from "jspdf";
import { formatUsdc, isInvoicePaid, type InvoiceAccount } from "./anchor";

interface DownloadInvoicePdfArgs {
  pda: string;
  invoice: InvoiceAccount["account"];
  freelancerName: string | null;
  clientName: string | null;
}

export function downloadInvoicePdf({
  pda,
  invoice,
  freelancerName,
  clientName,
}: DownloadInvoicePdfArgs): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  const paid = isInvoicePaid(invoice.status);
  const deadline = new Date(invoice.deadline.toNumber() * 1000);
  const created = new Date(invoice.createdAt.toNumber() * 1000);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text("Settlr", margin, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Verifiable invoicing. Invisible payments.", margin, 86);

  // Status pill (top right)
  const statusLabel = paid ? "PAID" : "PENDING";
  const pillColor: [number, number, number] = paid
    ? [16, 185, 129]
    : [234, 179, 8];
  doc.setFillColor(...pillColor);
  doc.roundedRect(pageWidth - margin - 70, 56, 70, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, pageWidth - margin - 35, 71, { align: "center" });

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, 110, pageWidth - margin, 110);

  // Invoice title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("INVOICE", margin, 140);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Issued ${created.toLocaleDateString()}`, margin, 156);
  doc.text(`Due ${deadline.toLocaleDateString()}`, margin, 170);

  // Amount (right aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(20, 20, 20);
  doc.text(`$${formatUsdc(invoice.amount)}`, pageWidth - margin, 150, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("USDC", pageWidth - margin, 166, { align: "right" });

  // Billed by / Billed to
  let y = 210;
  const colWidth = contentWidth / 2 - 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("BILLED BY", margin, y);
  doc.text("BILLED TO", margin + colWidth + 20, y);

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(freelancerName ? `@${freelancerName}` : "—", margin, y);
  doc.text(clientName ? `@${clientName}` : "—", margin + colWidth + 20, y);

  y += 14;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(invoice.freelancer.toString(), margin, y, { maxWidth: colWidth });
  doc.text(invoice.client.toString(), margin + colWidth + 20, y, {
    maxWidth: colWidth,
  });

  // Description box
  y += 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("DESCRIPTION", margin, y);

  y += 8;
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y, contentWidth, 50, 4, 4, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(invoice.description, margin + 12, y + 22, {
    maxWidth: contentWidth - 24,
  });

  // Payment direction
  y += 80;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("PAYMENT DIRECTION", margin, y);

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  const fromLabel = clientName
    ? `@${clientName}`
    : `${invoice.client.toString().slice(0, 8)}...`;
  const toLabel = freelancerName
    ? `@${freelancerName}`
    : `${invoice.freelancer.toString().slice(0, 8)}...`;

  doc.text(fromLabel, margin, y);
  const fromWidth = doc.getTextWidth(fromLabel);
  const arrowStart = margin + fromWidth + 14;
  const arrowEnd = arrowStart + 28;
  const arrowY = y - 3;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1.2);
  doc.line(arrowStart, arrowY, arrowEnd, arrowY);
  doc.setFillColor(16, 185, 129);
  doc.triangle(
    arrowEnd,
    arrowY,
    arrowEnd - 5,
    arrowY - 3.5,
    arrowEnd - 5,
    arrowY + 3.5,
    "F",
  );
  doc.text(toLabel, arrowEnd + 14, y);

  doc.setTextColor(120, 120, 120);
  doc.text(`$${formatUsdc(invoice.amount)} USDC`, pageWidth - margin, y, {
    align: "right",
  });

  // Footer with PDA
  const footerY = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("INVOICE PDA (on-chain receipt)", margin, footerY + 14);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(pda, margin, footerY + 28, { maxWidth: contentWidth });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Settled privately via Loyal. The invoice is on-chain. The payment isn't.",
    pageWidth / 2,
    footerY + 48,
    { align: "center" },
  );

  const filename = `settlr-invoice-${pda.slice(0, 8)}.pdf`;
  doc.save(filename);
}
