# ClaimFromPreviousButton

## Purpose

"This is mine too": when a radio you own took a new node number, claim the new node in one tap instead of going
through the normal claim steps.

## Props

- `newer: NodeIdentityRef` - the newer node (`replaced_by` of the old one). The request goes to **this** node.

## Where it shows

- `MyNodeCard`, when the card's node has `replaced_by` and that node is not in the card's `ownedNodeIds` (the user's
  claimed nodes, passed in by My nodes). Without `ownedNodeIds` the card never offers it.
- The old page's `NodeIdentityBanner` (full page, not the slide-over), only to the owner of the old node and only
  while the newer node (fetched quietly) does not already belong to them. Guests and other users make no request.

## Behaviour

`POST /nodes/observed-nodes/{newer}/claim-from-previous/`. On success the button turns into "Done. Node !x is now
yours too." and the node pages, lists and My nodes refresh. A second tap while it is sending is ignored.

One tap works only when Meshflow is confident the two numbers are the same radio, which is often not the case. So
`evidence_too_weak` is a normal outcome, not a failure: the text says Meshflow can't tell for certain and offers a
link, "Claim node !x", to the usual claim page (`/nodes/{id}/claim`). `already_claimed` does the same with its own
sentence. Other codes show plain text (`not_owner`, `no_previous`, `not_found`), or the API's `detail` for an unknown
code (via `identityLinkErrorMessage`).
