# NodeIdentityBanner

## Purpose

Tells a viewer about the other node numbers a radio has used. On Meshtastic 2.8 a firmware upgrade or re-key can give a
radio a new number, so Meshflow shows it as a new node and keeps the history on the old one. History is never moved; the
old and new pages link to each other. The old page says so loudly, the new page quietly.

## Props

- `node: ObservedNode` - reads `replaced_by` and `identity_chain` (`previous` and `next`, nearest first, at most 10 each).
- `compact?: boolean` - used in the slide-over (`NodeDetailSheet`); see below.

## What it shows

Nothing, when both fields are missing (an older API) or both lists are empty.

| State                                                  | Look                       | Text                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replaced (`replaced_by` set)                           | Prominent, blue info panel | "**This radio now uses node !new** (name). Heard 5 minutes ago. Go to !new" and "History up to (date) is on this page; newer history is on the new one." |
| Has a successor but not replaced (the radio came back) | Quiet line                 | "This radio also used node !new from (date) to (date)."                                                                                                  |
| Has previous numbers                                   | Quiet line                 | "Previously node !old (and N more). Older history is on those pages." "and N more" opens a list of the rest as links.                                    |

A middle node (replaced and with a previous number) shows the panel and the previous line together. The name and heard
time come from the newest successor (the last of `next`); "History up to" and "Why?" both refer to the nearest change
(the first of `next`), and dates show in the viewer's locale with the time.

Each state has a "Why?" disclosure in plain words: "Same public key", "The feeder reported the change", "The new number
was predicted from this node's public key", "Same hardware address", "The owner said so"; a staff-confirmed link adds
", confirmed by staff"; anything else reads "Linked by Meshflow". Ids are links to the other page (MeshCore ids use the
`mc:` form).

## One-tap claim

On the replaced panel, the **owner of the old node** also sees "This is mine too" (see
[`ClaimFromPreviousButton.md`](ClaimFromPreviousButton.md)) while the newer node is not already theirs. It claims the
newer node; when Meshflow is not sure enough it points to the normal claim page instead. Not shown in the compact form.

## Compact

In the slide-over only the prominent replaced line shows, with no "Why?", no "Go to" link and no "History up to" line.
The quiet successor and previous lines are left to the full page.

## Where it sits

`NodeDetailContent` renders it above the tab content on the full page and at the top of the non-tab/slide-over layout.
