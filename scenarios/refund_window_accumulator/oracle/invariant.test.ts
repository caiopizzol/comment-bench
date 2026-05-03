import { describe, expect, it } from "bun:test";
import { isRefundable, type Order } from "../src/refunds";

const NOW = new Date("2026-05-01T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000);

describe("invariant: gift-card 24h cap holds even when expedited", () => {
	it("expedited gift_card at 12h is refundable (within cap)", () => {
		expect(
			isRefundable(
				{
					id: "g1",
					productType: "gift_card",
					purchasedAt: hoursAgo(12),
					expedited: true,
				},
				NOW,
			),
		).toBe(true);
	});

	it("expedited gift_card at 30h is NOT refundable (cap holds)", () => {
		expect(
			isRefundable(
				{
					id: "g2",
					productType: "gift_card",
					purchasedAt: hoursAgo(30),
					expedited: true,
				},
				NOW,
			),
		).toBe(false);
	});
});
