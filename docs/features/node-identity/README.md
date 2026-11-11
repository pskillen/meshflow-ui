# Node identity (feature docs)

On Meshtastic 2.8 a firmware upgrade or re-key can give a radio a new node number. Meshflow then sees a new node and the
old one's history stays where it was. This feature links a radio's numbers both ways so people can find the rest of the
story. History is never moved or merged.

**Status:** node page banners and the Monitoring note are shipped (they need an API that sends `replaced_by` and
`identity_chain`; on an older API nothing new shows). Tags in lists and search, and hiding replaced nodes on maps, are
not covered here yet.

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
- **In the slide-over** only one line shows.

## When a node counts as replaced

A node is replaced when a newer number of the same radio has been heard at least as recently as it was. If the radio
goes back to the old number, the old number is no longer replaced and only gets the quiet line. The API decides this and
sends `replaced_by`; the UI just shows it.

## Monitoring

On a replaced node's Monitoring tab a note at the top says "Paused: this radio now uses node !new. Offline alerts for
this number are paused." The settings underneath are left as they are.

## Documentation map

| Doc                                                                                  | Purpose                                             |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| [`NodeIdentityBanner.md`](../../../src/components/nodes/NodeIdentityBanner.md)       | The banner's states, wording and compact form       |
| [`NodeDetailContent.md`](../../../src/components/nodes/NodeDetailContent.md)         | Where the banner sits on the node page              |
| [`FeederIdentityNotices.md`](../../../src/components/nodes/FeederIdentityNotices.md) | Owner-facing notices when a feeder's number changed |
