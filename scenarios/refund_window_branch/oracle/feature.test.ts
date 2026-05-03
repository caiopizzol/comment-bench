import { describe, expect, it } from "bun:test";
import { isRefundable, type Order } from "../src/refunds";

const NOW = new Date("2026-05-01T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const order = (p: Partial<Order>): Order => ({
	id: "test",
	productType: "normal",
	purchasedAt: NOW,
	expedited: false,
	...p,
});

describe("expedited tier", () => {
	it("expedited normal order at 10 days is refundable", () => {
		expect(
			isRefundable(order({ purchasedAt: daysAgo(10), expedited: true }), NOW),
		).toBe(true);
	});

	it("expedited normal order at 15 days is not refundable", () => {
		expect(
			isRefundable(order({ purchasedAt: daysAgo(15), expedited: true }), NOW),
		).toBe(false);
	});
});

describe("regression: existing behavior preserved", () => {
	it("normal order at 5 days is refundable", () => {
		expect(isRefundable(order({ purchasedAt: daysAgo(5) }), NOW)).toBe(true);
	});

	it("normal order at 10 days is not refundable", () => {
		expect(isRefundable(order({ purchasedAt: daysAgo(10) }), NOW)).toBe(false);
	});

	it("gift_card at 12h is refundable", () => {
		expect(
			isRefundable(
				order({ productType: "gift_card", purchasedAt: hoursAgo(12) }),
				NOW,
			),
		).toBe(true);
	});

	it("gift_card at 30h is not refundable", () => {
		expect(
			isRefundable(
				order({ productType: "gift_card", purchasedAt: hoursAgo(30) }),
				NOW,
			),
		).toBe(false);
	});
});
