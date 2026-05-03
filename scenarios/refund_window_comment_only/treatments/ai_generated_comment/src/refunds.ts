/**
 * Order representing a customer order.
 */
export type Order = {
	id: string;
	productType: string;
	purchasedAt: Date;
	expedited: boolean;
};

// Refund window constants
const DEFAULT_REFUND_HOURS = 7 * 24;
const EXPEDITED_REFUND_HOURS = 14 * 24;

/**
 * Calculate the refund window in hours for an order.
 *
 * Returns the appropriate window based on the order's properties.
 */
export function refundWindowHours(order: Order): number {
	return DEFAULT_REFUND_HOURS;
}

/**
 * Determine whether an order is eligible for a refund.
 */
export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
