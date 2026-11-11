# Node identity (feature docs)

On Meshtastic 2.8 a firmware upgrade or re-key can give a radio a new node number. Meshflow then sees a new node and the
old one's history stays where it was. This feature links a radio's numbers both ways so people can find the rest of the
story. History is never moved or merged.

**Status:** shipped: node page banners, owner review of links and declaring a replacement, the Monitoring note, "Replaced" tags in search, node lists and My nodes, and
replaced nodes hidden on maps. They need an API that sends `replaced_by` and `identity_chain`; on an older API nothing
new shows.

## What people see

- **On the old page** (the number is "replaced"): a prominent blue panel, "This radio now uses node !new (name). Heard
  5 minutes ago." with a link, and a line saying history up to a date is on this page while newer history is on the new
  one.
- **On the new page**: one quiet line, "Previously node !old. Older history is on that page." If there are several, "and
  N more" opens a list of the rest.
- **A radio that went back to an old number**: the old number is not replaced, so it gets a quiet line, "This radio also
  used node !other from (date) to (date)."
- **A "Why?" disclosure** on each line gives the reason in plain words (same public key, the feeder reported the
  change, and so on).
- **In the slide-over** only the prominent replaced line shows (the quiet lines stay on the full page).
- **In search**: a result for a replaced node carries a small "Replaced → !new" tag. Picking the row still opens (or
  selects) the old node, since that is what was searched for; the tag's own link opens the new one. Nothing redirects.
- **In node lists** (the protocol Nodes page): the same tag sits beside the ID, and under the name on narrow screens.
- **On My nodes**: the card says "Replaced by !new" with a link to the new node.
- **On maps**: replaced nodes are not drawn (the overview maps only: the dashboard and protocol `NodesAndConstellationsMap`, and the protocol nodes page `NodesMap`, which sets `hideReplaced`; a node's own page, the traceroute target and the monitor map still draw it). The filter is applied in the browser
  to the same node list the tables use, so there is no extra request. Nodes that went back to an old number, and nodes
  from an older API, are drawn as before. The infrastructure and weather maps are unchanged.

## Reviewing links

Owners (of the node) and staff can act on links from the node's Overview tab, in "Other numbers for this radio"
(guests and other users do not see it). Each link reads "Same radio as node !x (name) (reason; the newer / older
number)" with its state: "suggested by Meshflow", "linked by Meshflow", "confirmed", "marked not the same radio" or
"held for staff to review". Suggested links come first, rejected last.

- **Confirm** turns a suggestion into a confirmed link. **Not the same radio** (after a short "are you sure") rejects it.
  The buttons show only when the API says the user may (`can_confirm`, `can_reject`).
- **Declare a replacement** (the dialog): pick the newer node by search to say this radio now uses it. Both nodes must
  be the owner's (staff may link any two). Errors are shown in plain words in the dialog, for example when one of the
  nodes is already linked to another radio, or when the link would make two nodes replace each other.
- After any change the page, the banner, tags and lists refresh.

The wording avoids "identity link", "key" and "evidence" on purpose.

## When a node counts as replaced

A node is replaced when a newer number of the same radio has been heard at least as recently as it was. If the radio
goes back to the old number, the old number is no longer replaced and only gets the quiet line. The API decides this and
sends `replaced_by`; the UI just shows it.

## Monitoring

On a replaced node's Monitoring tab a note at the top says "Paused: this radio now uses node !new. Offline alerts for
this number are paused." The settings underneath are left as they are.

## Documentation map

| Doc                                                                                          | Purpose                                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`NodeIdentityBanner.md`](../../../src/components/nodes/NodeIdentityBanner.md)               | The banner's states, wording and compact form         |
| [`ReplacedTag.md`](../../../src/components/nodes/ReplacedTag.md)                             | The "Replaced" tag used in search, lists and My nodes |
| [`NodeSearch.md`](../../../src/components/NodeSearch.md)                                     | Tag in search results                                 |
| [`NodesTable.md`](../../../src/components/nodes/NodesTable.md)                               | Tag in node lists                                     |
| [`NodesAndConstellationsMap.md`](../../../src/components/nodes/NodesAndConstellationsMap.md) | Replaced nodes hidden on maps                         |
| [`NodeIdentityLinksSection.md`](../../../src/components/nodes/NodeIdentityLinksSection.md)   | Reviewing links and declaring a replacement           |
| [`NodeDetailContent.md`](../../../src/components/nodes/NodeDetailContent.md)                 | Where the banner sits on the node page                |
| [`FeederIdentityNotices.md`](../../../src/components/nodes/FeederIdentityNotices.md)         | Owner-facing notices when a feeder's number changed   |
