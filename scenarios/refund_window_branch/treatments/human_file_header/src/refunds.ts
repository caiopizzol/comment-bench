/**
 * Refund eligibility rules.
 *
 * Refund windows by payment rail:
 *   - Gift cards: 24 hours from purchase. Hard cap. The downstream processor
 *     settles gift-card funds at T+1 and refunds become impossible after that
 *     point. This window is independent of any tier or promotion.
 *   - Standard orders: 7 days from purchase.
 *
 * When new tiers (expedited, VIP, promotional) extend the standard window,
 * they must not extend the gift-card window.
 */

export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	if (order.productType === "gift_card") {
		return elapsedHours <= 24;
	}
	return elapsedHours <= 7 * 24;
}
