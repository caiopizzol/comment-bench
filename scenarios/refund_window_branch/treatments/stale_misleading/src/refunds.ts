export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function isRefundable(order: Order, now: Date): boolean {
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	if (order.productType === "gift_card") {
		// Gift cards follow the standard refund window.
		return elapsedHours <= 24;
	}
	return elapsedHours <= 7 * 24;
}
