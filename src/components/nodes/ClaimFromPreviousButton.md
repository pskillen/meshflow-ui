# ClaimFromPreviousButton

## Purpose

"This is mine too": when a radio you own took a new node number, claim the new node in one tap instead of going
through the normal claim steps.

## Props

- `newer: NodeIdentityRef` - the newer node (`replaced_by` of the old one). The request goes to **this** node.
- `onDone?: () => void` - called on success. The parent uses it to keep the component mounted after the refetch
  would otherwise hide it (the new node is then owned), so the confirmation stays on screen.

## Where it shows

- `MyNodeCard`, when the card's node has `replaced_by` and that node is not in the card's `ownedNodeIds` (the user's
  claimed nodes, passed in by My nodes). Without `ownedNodeIds` the card never offers it.
- The old page's `NodeIdentityBanner` (full page, not the slide-over), only to the owner of the old node and only
  while the newer node (fetched quietly) has no owner. Guests and other users make no request, and nothing is offered
  when someone else already owns the newer node. A newer node the user manages but has not claimed counts as unowned,
  which is right: the API lets them claim it.

## Behaviour

`POST /nodes/observed-nodes/{newer}/claim-from-previous/`. On success the button turns into "Done. Node !x is now
yours too." and the node pages, lists and My nodes refresh. A second tap while it is sending is ignored.

The outcome is written into a `role="status"` block that is always mounted (so screen readers announce the text when it
appears) and takes focus when the button is swapped out. State is one value: idle, done, fallback or error. Each
button's name includes the node ("This is mine too, node !x") so several cards are told apart.

One tap works only when Meshflow is confident the two numbers are the same radio, which is often not the case. So
`evidence_too_weak` is a normal outcome, not a failure: the text says Meshflow can't tell for certain and offers a
link, "Claim node !x", to the usual claim page (`/nodes/{id}/claim`). `already_claimed` does the same with its own
sentence. Other codes show plain text (`not_owner`, `no_previous`, `not_found`), or the API's `detail` for an unknown
code (via `identityLinkErrorMessage`).
