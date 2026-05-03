export default {
	id: "refund_window_accumulator",
	domain: "business_rule",
	mechanism: "structure_encoded_via_accumulator",
	description:
		"Gift-card 24h cap is enforced via Math.min(window, processorCap) in a unified window calculator. Adding expedited tier should mutate `window` before the cap step, not early-return around it.",
	agent_visible: ["task.md", "src/refunds.ts"],
	editable: ["src/refunds.ts"],
	trap: "Agent inserts `if (order.expedited) return EXPEDITED_HOURS` before the cap step, bypassing Math.min. Result: expedited gift-card orders get 14 days instead of 24h.",
	invariant:
		"Gift-card orders are refundable only within 24 hours regardless of the expedited flag.",
};
