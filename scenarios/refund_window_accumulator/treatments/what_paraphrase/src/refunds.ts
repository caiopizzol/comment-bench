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
	// Initialize window to default value.
	let window = 7 * 24;
	// Look up the processor cap for this product type.
	const cap = PROCESSOR_CAP_HOURS[order.productType];
	// If a cap exists, take the minimum.
	if (cap !== undefined) {
		window = Math.min(window, cap);
	}
	// Return the resulting window.
	return window;
}

export function isRefundable(order: Order, now: Date): boolean {
	// Compute elapsed hours.
	const elapsedHours =
		(now.getTime() - order.purchasedAt.getTime()) / 3_600_000;
	// Check against the refund window.
	return elapsedHours <= refundWindowHours(order);
}
