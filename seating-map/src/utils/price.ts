/**
 * Price tiers are small integers in the data (1, 2, 3...).
 * This maps them to actual prices. In a real app this would come from
 * the API alongside the venue data; hardcoded here since the spec doesn't
 * provide it.
 */
const TIER_PRICES: Record<number, number> = {
  1: 150,
  2: 110,
  3: 85,
  4: 60,
  5: 40,
};

const FALLBACK_PRICE = 50;

export function priceForTier(tier: number): number {
  return TIER_PRICES[tier] ?? FALLBACK_PRICE;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
