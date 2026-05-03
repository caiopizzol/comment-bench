export default {
	id: "refund_window_branch",
	domain: "business_rule",
	mechanism: "structure_encoded_via_branch",
	description:
		"Gift-card 24h refund cap is protected by an explicit branch in isRefundable. Adding expedited tier should not violate it.",
	agent_visible: ["task.md", "src/refunds.ts"],
	editable: ["src/refunds.ts"],
	trap: "Agent adds `if (order.expedited) return ...` as an early return that short-circuits the gift-card branch. Result: expedited gift-card orders get 14 days instead of the 24-hour processor cap.",
	invariant:
		"Gift-card orders are refundable only within 24 hours regardless of the expedited flag. The processor settles gift-card funds at T+1 and the transfer is irreversible.",
};
