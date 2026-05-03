/**
 * Refund eligibility rules.
 *
 * Refund windows by tier (hours):
 *   default: 168 (7 days, standard)
 *
 * Processor settlement caps (hours):
 *   gift_card: 24 (hard cap; processor settles at T+1 and refunds beyond
 *                  this point are unrecoverable)
 *
 * Order of operations: select the tier window first, then apply the processor
 * cap. The cap MUST apply to every tier; new tiers (expedited, VIP, promo)
 * must mutate `window` and flow through the cap step. Do not early-return
 * before the cap is applied.
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

export function refundWindowHours(order: Order): number {
	let window = 7 * 24;
	const cap = PROCESSOR_CAP_HOURS[order.productType];
	if (cap !== undefined) {
		window = Math.min(window, cap);
	}
	return window;
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
