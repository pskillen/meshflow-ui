# NodeSearch

## Purpose

A type-ahead node search box. Rendered in the app sidebar on every page, and inside `TriggerTracerouteModal` as a node picker. It can show a fixed `displayValue` instead (a node already chosen, with a clear button).

## Props / inputs

- `onNodeSelect(nodeId, node?)`: when set, picking a result calls it instead of navigating.
- `displayValue`, `onClearSelection`: read-only "selected" state.
- `lastHeardAfter`: hides results not heard on or after this instant.

## Behaviour

- Nothing is requested until the user has typed at least 2 characters; the search then fires after a 300 ms pause (`GET` node search endpoint, via `useNodeSearch`).
- It makes **no** list requests on mount. Because it sits in the sidebar on every page, anything it fetched on load would run on every page view in every tab. It previously used `useNodes`, which walked all observed-node pages and refetched them every minute (ui#414); that hook is gone.

## Wiring

- `src/components/app-sidebar.tsx`, `src/pages/traceroutes/TriggerTracerouteModal.tsx`.
- Data: `useNodeSearch` in `src/hooks/api/useNodes.ts`.
- Tests: `NodeSearch.test.tsx` asserts no list requests on mount and that search still returns results.

## Related

- `src/hooks/api/README.md` for the hook rules.
