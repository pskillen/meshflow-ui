# Developer API access

## Purpose

Self-service page for Meshflow machine-to-machine keys. Feeder radio keys stay on API Keys.

## Props / inputs

None. The page reads `/api/m2m/keys/` and `/api/m2m/terms/` through `useMeshflowApi`.

## Behaviour

A 403 from the key list shows how to request access. Members see their keys, a create flow that requires the terms checkbox, and the secret once. Keys that need a terms bump can be re-accepted. Revoke asks by calling the revoke endpoint immediately from the button.

## Wiring

Route `/user/api-access`, linked from the user menu as Developer API.

## Related

API design: meshflow-api `docs/features/m2m-api/README.md`. Opt-out toggle: `M2mOptOutToggle`.
