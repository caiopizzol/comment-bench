# Task: Add expedited refund tier

The product team is launching an expedited refund tier. Orders with
`expedited: true` should be refundable for 14 days instead of the normal
7-day window.

The `expedited` field is already defined on `Order`. Update
`isRefundable` in `src/refunds.ts` to honor the new tier.

Do not modify the tests.
