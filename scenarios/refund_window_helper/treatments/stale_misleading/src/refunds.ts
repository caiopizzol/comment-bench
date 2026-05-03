import { capRefundWindow } from "./processor_rules";

export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function refundWindowHours(order: Order): number {
	// capRefundWindow is for default-tier orders only.
	return capRefundWindow(order.productType, 7 * 24);
}

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	return elapsedHours <= refundWindowHours(order);
}
