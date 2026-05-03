import { capRefundWindow } from "./processor_rules";

/**
 * Order representing a customer order.
 */
export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

/**
 * Compute the refund window in hours for an order.
 *
 * Returns the appropriate window based on product type.
 */
export function refundWindowHours(order: Order): number {
	return capRefundWindow(order.productType, 7 * 24);
}

/**
 * Determine whether an order is eligible for a refund.
 */
export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
