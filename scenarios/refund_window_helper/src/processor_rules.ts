const PROCESSOR_CAP_HOURS: Record<string, number> = {
	gift_card: 24,
};

export function capRefundWindow(productType: string, hours: number): number {
	const cap = PROCESSOR_CAP_HOURS[productType];
	return cap !== undefined ? Math.min(hours, cap) : hours;
}
