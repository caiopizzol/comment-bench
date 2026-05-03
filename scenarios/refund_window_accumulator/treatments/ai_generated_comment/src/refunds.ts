/**
 * Order representing a customer order.
 */
export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

const PROCESSOR_CAP_HOURS: Record<string, number> = {
	gift_card: 24,
};

/**
 * Calculate the refund window in hours for an order.
 *
 * Returns the appropriate window based on product type and processor
 * constraints.
 */
export function refundWindowHours(order: Order): number {
	let window = 7 * 24;
	// Apply processor-specific cap if applicable
	const cap = PROCESSOR_CAP_HOURS[order.productType];
	if (cap !== undefined) {
		window = Math.min(window, cap);
	}
	return window;
}

/**
 * Determine whether an order is eligible for a refund.
 */
export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
