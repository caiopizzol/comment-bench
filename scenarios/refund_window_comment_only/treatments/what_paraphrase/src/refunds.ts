export type Order = {
	id: string;
	productType: string;
	purchasedAt: Date;
	expedited: boolean;
};

// Refund window constants in hours.
const DEFAULT_REFUND_HOURS = 7 * 24;
const EXPEDITED_REFUND_HOURS = 14 * 24;

// Return the refund window for an order.
export function refundWindowHours(order: Order): number {
	return DEFAULT_REFUND_HOURS;
}

// Determine whether the order is still within its refund window.
export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
