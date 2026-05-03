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
		// Gift-card refunds must remain within 24h regardless of any other tier.
		// The downstream processor settles gift-card funds at T+1 and the transfer
		// is irreversible, so refund windows beyond 24h are unrecoverable losses.
		return elapsedHours <= 24;
	}
	return elapsedHours <= 7 * 24;
}
