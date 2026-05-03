export type Order = {
	id: string;
	productType: "normal" | "gift_card";
	purchasedAt: Date;
	expedited: boolean;
};

export function isRefundable(order: Order, now: Date): boolean {
	// Calculate the number of hours since the order was purchased.
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	// Check if the product is a gift card.
	if (order.productType === "gift_card") {
		// Return whether the elapsed hours are within 24.
		return elapsedHours <= 24;
	}
	// Return whether the elapsed hours are within the 7-day window.
	return elapsedHours <= 7 * 24;
}
