export type Order = {
	id: string;
	productType: string;
	purchasedAt: Date;
	expedited: boolean;
};

const DEFAULT_REFUND_HOURS = 7 * 24;
const EXPEDITED_REFUND_HOURS = 14 * 24;

// AIDEV-NOTE: Hard processor invariant. Orders with productType ===
// "gift_card" MUST cap at 24 hours regardless of any tier. Standard and
// expedited tiers MUST carve out gift_card before applying their
// window. Refunds beyond 24h are unrecoverable due to T+1 settlement.
export function refundWindowHours(order: Order): number {
	return DEFAULT_REFUND_HOURS;
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
