# Messages UI — gaps and roadmap

Planning reference for message history improvements. GitHub issues in **meshflow-ui**; epic in **meshflow-api**.

## Issue mapping

### [#277 — Filter by constellation protocol](https://github.com/pskillen/meshflow-ui/issues/277)

| Area                   | Today                         | Target                                                                                |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| Constellation picker   | All constellations            | Only constellations whose `protocol` matches page (`meshtastic` / `meshcore`)         |
| Channel picker         | `filterChannelsForProtocol` ✓ | Keep; ensure API channel `protocol` always set for MC                                 |
| Shared / dual-protocol | N/A in backend                | Constellation is single-protocol; “both” = user has two constellations, not one mixed |

**Implementation notes**

- Add `protocol` to UI `Constellation` type (OpenAPI already has it).
- `filterConstellationsForProtocol(constellations, slug)` alongside existing channel filter.
- Empty state when zero constellations for protocol.

### [#278 — Constellation picker UX](https://github.com/pskillen/meshflow-ui/issues/278)

| Area              | Today                                 | Target                                                                             |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Default selection | First constellation + first channel   | Keep; add optional **localStorage** last constellation (and channel?) per protocol |
| Picker control    | `<select>`                            | Tabs or button row; optional unread badge per constellation                        |
| Friction          | Must change dropdown if default wrong | One-click switch                                                                   |

Depends on [#277] so the auto-selected constellation is protocol-valid.

### [#281 — Better channels UI](https://github.com/pskillen/meshflow-ui/issues/281)

| Area            | Today                                 | Target                                                                                          |
| --------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Channel control | Single `<select>`, one active channel | Search/filter; grid or list; show `display_label` / `#hashtag`, type (PUBLIC/HASHTAG), protocol |
| Scale           | Poor for 10+ MC channels              | Desktop/tablet usable at 10+                                                                    |
| MC ops          | Not on messages page                  | Surface sync/apply status where API allows (link to node settings or inline status)             |

Likely layout: **constellation tabs** (row 1) + **channel sidebar or chip list** (row 2) + **message pane** — works for MT (few channels) and MC (many).

## Cross-cutting gaps (not separate issues)

### Unread model

- **Shipped ([#279](https://github.com/pskillen/meshflow-ui/issues/279)):** protocol nav badges, per-channel badges on messages page, channel button row — [docs/features/messages/unread-count.md](../features/messages/unread-count.md).
- **Deferred ([meshflow-api#396](https://github.com/pskillen/meshflow-api/issues/396)):** constellation-level unread rollup; per-channel badges across constellations; auto-select mark-as-read nuance.
- **Future:** persist or rehydrate unread across reload.

### Layout

- Evaluate **Discord-style** flat log vs current cards for scanability at high volume (MC).
- Consider sticky date separators, compact density toggle.

### Realtime

- WS filter should align with REST: `constellation_id` if present on payload.
- Optional: background count or “N new” when viewing one channel but WS receives on another in same constellation.

### Typing / API parity

- `Constellation.protocol` missing from `src/lib/models.ts`.
- `MessageChannel.mc_channel_type` typed loosely as `string`; align with `'PUBLIC' | 'HASHTAG'` where API guarantees it.

### Nested MT replies

- Product expectation: nested replies + emoji on nested threads.
- UI: only one reply tier; needs recursive or tree renderer if API stores chains.

### Per-node message history

- `MessageList` `nodeId` prop unused on main pages — potential node detail tab later.

## Suggested implementation order

1. **#277** — protocol-filtered constellations (fixes wrong empty/wrong channels).
2. **#278** — constellation tabs + localStorage default (quick win for daily use).
3. **Unread extension** — channel badges when channel list exists (supports sidebar + list UX).
4. **#281** — channel list/grid + search.
5. **Layout pass** — flat log option, MC density, optional MC sync hints.

## Acceptance checklist (combined)

- [ ] MT messages page: only MT constellations and channels.
- [ ] MC messages page: only MC constellations and channels.
- [ ] Open page with ≥1 constellation: messages visible without manual pick.
- [ ] Switch constellation/channel in one click (no long dropdown hunt).
- [ ] 10+ MC channels: find by name/filter without endless `<select>`.
- [ ] Unread: separate MT vs MC nav badges (existing); channel badges when channel list shipped.
- [ ] Heard count + dialog unchanged or improved per message.
- [ ] MT replies/emoji behaviour preserved (or nested reply support explicitly scoped).

## Tests to touch when implementing

- `src/lib/message-channels.test.ts` — extend for constellation filtering.
- `src/lib/message-protocol.test.ts` — route / protocol helpers.
- `src/components/nav-main.test.tsx` — unread badges per protocol.
- New tests for picker filtering and default selection logic (extract pure functions from page component).
