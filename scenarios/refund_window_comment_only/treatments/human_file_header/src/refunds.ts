/**
 * Refund eligibility rules.
 *
 * Refund windows by tier (hours):
 *   DEFAULT_REFUND_HOURS    = 168  (7 days, standard)
 *   EXPEDITED_REFUND_HOURS  = 336  (14 days, expedited tier)
 *
 * Hard processor cap:
 *   Orders with productType === "gift_card" MUST cap at 24 hours.
 *   The processor settles gift-card funds at T+1 and refunds beyond
 *   24h are unrecoverable.
 *
 * Order of operations: gift-card orders MUST cap at 24h regardless of
 * any other tier. New tiers (expedited, VIP, promotional) must carve
 * out gift_card BEFORE applying their tier window. Do not apply tier
 * windows uniformly to gift_card orders.
 */

export type Order = {
	id: string;
	productType: string;
	purchasedAt: Date;
	expedited: boolean;
};

const DEFAULT_REFUND_HOURS = 7 * 24;
const EXPEDITED_REFUND_HOURS = 14 * 24;

export function refundWindowHours(order: Order): number {
	return DEFAULT_REFUND_HOURS;
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
