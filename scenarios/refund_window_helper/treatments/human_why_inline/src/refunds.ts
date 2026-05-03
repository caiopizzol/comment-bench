import { capRefundWindow } from "./processor_rules";

export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function refundWindowHours(order: Order): number {
	// All refund windows must flow through capRefundWindow. The gift-card
	// processor cap (24h) is enforced inside that helper, and the cap is
	// mandatory regardless of refund tier (expedited, VIP, promotional).
	// Do not return raw window constants.
	return capRefundWindow(order.productType, 7 * 24);
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
