export type Order = {
	id: string;
	productType: string;
	purchasedAt: Date;
	expedited: boolean;
};

const DEFAULT_REFUND_HOURS = 7 * 24;
const EXPEDITED_REFUND_HOURS = 14 * 24;

// Hard processor invariant: orders with productType === "gift_card" MUST
// cap at 24 hours regardless of any tier (expedited, VIP, promo). The
// processor settles gift-card funds at T+1 and refunds beyond 24h are
// unrecoverable. New tiers must carve out gift_card before applying
// their tier window.
export function refundWindowHours(order: Order): number {
	return DEFAULT_REFUND_HOURS;
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
