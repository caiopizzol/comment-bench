import { capRefundWindow } from "./processor_rules";

export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function refundWindowHours(order: Order): number {
	// Compute the refund window for this order.
	return capRefundWindow(order.productType, 7 * 24);
}

export function isRefundable(order: Order, now: Date): boolean {
	// Compute hours since purchase.
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	// Compare to the refund window.
	return elapsedHours <= refundWindowHours(order);
}
