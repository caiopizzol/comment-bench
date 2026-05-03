/**
 * Refund eligibility rules.
 *
 * Refund tiers (hours):
 *   default: 168 (7 days, standard)
 *
 * Invariant: every refund window returned from this module MUST be passed
 * through `capRefundWindow` from `./processor_rules`. The processor settlement
 * cap (gift-card: 24h hard cap) is enforced inside that helper. New tiers
 * must call the helper with the tier window; do not return raw constants.
 *
 * The cap exists because the downstream processor settles gift-card funds at
 * T+1, after which refunds are unrecoverable.
 */
import { capRefundWindow } from "./processor_rules";

export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function refundWindowHours(order: Order): number {
	return capRefundWindow(order.productType, 7 * 24);
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
