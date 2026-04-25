// Devnet by default — flip to "mainnet" once we deploy.
const SOLSCAN_CLUSTER = "devnet";

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=${SOLSCAN_CLUSTER}`;
}

export function truncateSig(signature: string): string {
  if (signature.length <= 12) return signature;
  return `${signature.slice(0, 6)}…${signature.slice(-6)}`;
}

export function openSolscan(signature: string): void {
  if (typeof window === "undefined") return;
  window.open(solscanTxUrl(signature), "_blank", "noopener,noreferrer");
}
