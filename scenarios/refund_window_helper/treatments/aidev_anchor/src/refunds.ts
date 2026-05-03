import { capRefundWindow } from "./processor_rules";

export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function refundWindowHours(order: Order): number {
	// AIDEV-NOTE: Load-bearing invariant. ALL returned refund-window hours
	// MUST flow through capRefundWindow. New tiers (expedited, VIP, promo)
	// must call the helper with the tier window. Do NOT early-return raw
	// window constants.
	return capRefundWindow(order.productType, 7 * 24);
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
