# Public data API opt-out

## Purpose

Toggle that sets `ObservedNode.m2m_opt_out` for the claimant, feeder owner, or staff.

## Props / inputs

`internalId`, current `optedOut`, and `editable` (`m2m_opt_out_editable` from the API). Hidden when `editable` is false.

## Behaviour

PATCH `/nodes/observed-nodes/{id}/environment-settings/` with `{ m2m_opt_out }`. The switch moves immediately and rolls back if the request fails.

## Wiring

Rendered on the node detail page when the flag is editable.

## Related

`ApiAccessPage` for key management.
