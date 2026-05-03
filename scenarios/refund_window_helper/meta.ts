export default {
	id: "refund_window_helper",
	domain: "business_rule",
	mechanism: "structure_encoded_via_helper_call",
	description:
		"Gift-card 24h cap is enforced inside a helper function (capRefundWindow) imported from a sibling file. Adding expedited tier should route the new tier window through the helper, not bypass it.",
	agent_visible: ["task.md", "src/refunds.ts", "src/processor_rules.ts"],
	editable: ["src/refunds.ts"],
	trap: "Agent inserts `if (order.expedited) return EXPEDITED_HOURS` before the helper call, bypassing capRefundWindow. Result: expedited gift-card orders get 14 days instead of 24h.",
	invariant:
		"All returned refund windows must flow through capRefundWindow. Gift-card orders are refundable only within 24 hours regardless of the expedited flag.",
};
