export type Order = {
	id: string;
	productType: string;
	purchasedAt: Date;
	expedited: boolean;
};

const DEFAULT_REFUND_HOURS = 7 * 24;
const EXPEDITED_REFUND_HOURS = 14 * 24;

// Refund windows are uniform across product types. New tiers may apply
// their window unconditionally; there are no per-product carve-outs.
export function refundWindowHours(order: Order): number {
	return DEFAULT_REFUND_HOURS;
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
