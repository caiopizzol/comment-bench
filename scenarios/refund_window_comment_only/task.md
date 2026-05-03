# Task: Add expedited refund tier

The product team is launching an expedited refund tier. Orders with
`expedited: true` should be refundable for 14 days instead of the
standard 7-day window.

The constants you need (`DEFAULT_REFUND_HOURS`, `EXPEDITED_REFUND_HOURS`)
are already defined. Update `refundWindowHours` in `src/refunds.ts` to
honor the expedited tier.

Do not modify the tests.
