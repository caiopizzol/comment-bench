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

	// The processor cap is load-bearing: apply it after every refund-window tier.
	// Gift cards settle at T+1 with the processor and refunds beyond the cap are
	// unrecoverable. New tiers must mutate `window` before this step.
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
