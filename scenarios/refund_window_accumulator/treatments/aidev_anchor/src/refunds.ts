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

	// AIDEV-NOTE: Load-bearing invariant. The processor cap MUST apply after
	// every refund-window tier. New tiers (expedited, VIP, promo) must mutate
	// `window` BEFORE this step. Do NOT early-return around the cap.
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
