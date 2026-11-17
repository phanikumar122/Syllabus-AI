// Stripe charge units differ from ISO display precision for currencies such as ISK/UGX.
const zeroDecimal = new Set(
  "bif clp djf gnf jpy kmf krw mga pyg rwf vnd vuv xaf xof xpf".split(" "),
);
export function stripeMajorAmount(amount: number, currency: string): number {
  const code = currency.toLowerCase();
  return amount / (zeroDecimal.has(code) ? 1 : 100);
}
