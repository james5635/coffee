# Phase 2 frontend — known limitations

These incomplete workflows are deliberate: Phase 2 is frontend-only and must not simulate backend
capabilities that do not exist. They are also surfaced in the UI where staff or customers hit them.

1. **No persistent order tracking.** Placing an order shows an immediate confirmation with the
   server-computed totals and the order number. There is no reopen/retrieve page and no live
   tracking; the backend returns an order by ID but the frontend does not promise guest access to
   it later. See the confirmation note in `pages/order`.

2. **Staff order discovery is ID lookup only.** There is no shop-wide order list, completed-order
   query, or payment/refund listing. Cashiers and managers look up an order by ID on the payments
   screen; the backend enforces which orders each role may read.

3. **Refund management is per-order and incomplete.** `issueRefund` is available to roles holding
   `payment.refund` (manager/owner, not cashier) and is capped server-side at the net amount
   collected on that order. There is no refund approval workflow, partial-refund history beyond the
   order's payment events, or refund reporting.

4. **READY → COMPLETED is not implemented.** The preparation queue returns ACCEPTED/PREPARING orders
   only, so READY orders cannot be retrieved and completed. Baristas can advance ACCEPTED → PREPARING
   → READY; the payments screen still reflects the payment position of any order it can load. See
   `pages/prep`.

Additional product limits inherited from the backend: no online payment step (staff record payment
at the counter), no menu/staff admin mutations, no inventory UI, and no sales reports.
