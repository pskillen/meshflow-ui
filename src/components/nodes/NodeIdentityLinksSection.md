# NodeIdentityLinksSection

## Purpose

Lets the **owner** of a node, and **staff**, act on the links between that node's number and other numbers of the same
radio: confirm one Meshflow only suggested, or say it is "not the same radio". It also holds the **Declare a
replacement** button ([`DeclareReplacementDialog`](./DeclareReplacementDialog.tsx)). The read-only banner for everyone
else is [`NodeIdentityBanner`](./NodeIdentityBanner.md).

## Props

`node` (the observed node) and `internalId`.

## Behaviour

- **Who sees it:** a signed-in user who owns the node, or staff. Not MeshCore nodes. Everyone else gets nothing and the
  page makes **no request** for them (the query is disabled). An older API (404) or a failed load also shows nothing.
- Titled "Other numbers for this radio", on the Overview tab above "Right now". With no links it says "Nothing linked"
  and still offers the Declare button.
- **Each link:** "Same radio as node [!id] (name) (reason; the newer/older number)", with the other node's id linking to
  its page, and a badge for its state: "suggested by Meshflow", "linked by Meshflow", "confirmed", "marked not the same
  radio", "held for staff to review". Reasons use the same plain words as the banner's "Why?".
- **Order:** suggested first (they need a decision), then live links, rejected last.
- **Buttons follow the API:** **Confirm** only when `can_confirm`; **Not the same radio** only when `can_reject`, and it
  asks first ("Not the same radio?" with Cancel and a confirming button).
- Each write sends once however fast it is double-clicked (a `useRef` guard, as in `FeederIdentityNotices`). On success
  the `['nodes']`, `['observed-nodes','mine']` and `['managed-nodes']` queries are invalidated, so this page, the
  banner and the lists refresh.
- **Errors** are `{code, detail}`; each known code has plain text (`identityLinkErrors.ts`), an unknown code shows the
  API's `detail`: `link_conflict`, `link_cycle`, `not_owner`, `cross_protocol`, `same_node`, `invalid_state`,
  `not_found`, `ambiguous_node`.

## Declare a replacement

A dialog with a node search ([`NodeSearch`](../NodeSearch.md)). The hint says both nodes must be the user's (staff: "can
link any two nodes"). The pick is sent as `{new_node: "!hex"}` to
`POST /nodes/observed-nodes/{id}/identity-links/`. The API answers 201 for a new or promoted link and 200 for a repeat;
the UI treats both as success: it closes and refreshes. Errors show inside the dialog and it stays open.

## Wiring

`NodeDetailContent` (full page, Overview). Hooks: `useNodeIdentityLinks`, `useConfirmNodeIdentityLink`,
`useRejectNodeIdentityLink`, `useDeclareNodeReplacement` in `src/hooks/api/useNodeIdentityLinks.ts`. Tests:
`NodeIdentityLinksSection.test.tsx`, and `tests/browser/node-identity-review.spec.ts` (banner plus confirm flow).

## Related

[`NodeIdentityBanner.md`](./NodeIdentityBanner.md), [`NodeDetailContent.md`](./NodeDetailContent.md),
[`docs/features/node-identity/README.md`](../../../docs/features/node-identity/README.md).
