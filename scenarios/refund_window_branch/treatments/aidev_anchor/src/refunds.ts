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
		// AIDEV-NOTE: Hard processor invariant. Gift-card refund window is 24h
		// and must NOT be extended by any tier (expedited, VIP, promo). See
		// processor settlement contract.
		return elapsedHours <= 24;
	}
	return elapsedHours <= 7 * 24;
}
