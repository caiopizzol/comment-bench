export default {
	id: "refund_window_comment_only",
	domain: "business_rule",
	mechanism: "comment_only_invariant",
	description:
		"The 24h gift-card cap is NOT enforced anywhere in the code. The constants are defined but the function returns DEFAULT_REFUND_HOURS for everything. The cap rule lives only in the comment payload of relevant treatments. The agent must read the comment to know about the cap.",
	agent_visible: ["task.md", "src/refunds.ts"],
	editable: ["src/refunds.ts"],
	trap: "Task asks the agent to add expedited tier (14 days). The natural fix returns EXPEDITED for expedited orders without carving out gift-card. Result: expedited gift-card orders get 14 days because no structural cap exists.",
	invariant:
		"Gift-card orders are refundable only within 24 hours regardless of the expedited flag. This rule is only encoded in the comment of high-signal treatments.",
};
