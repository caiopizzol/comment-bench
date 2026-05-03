/**
 * Order type representing a customer order.
 */
export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

/**
 * Determine whether an order is eligible for a refund.
 *
 * Returns true if the order is within the refund window for its type.
 * Gift cards have a special, shorter refund policy.
 */
export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	// Gift cards are handled separately
	if (order.productType === "gift_card") {
		return elapsedHours <= 24;
	}
	// Standard refund window
	return elapsedHours <= 7 * 24;
}
