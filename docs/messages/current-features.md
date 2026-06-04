# Messages UI — current features

Reverse-engineered from the codebase as of the docs migration. Meshtastic (MT) and MeshCore (MC) share the same components unless noted.

## Scope and grouping

### Protocol-scoped pages

- Separate URLs and sidebar entries under **Meshtastic** vs **MeshCore** sections.
- `MessageList` receives `protocol={config.slug}` so REST calls include `protocol=meshtastic|meshcore`.

### Constellations (regions)

- Picker: HTML `<select>` of **all** constellations returned by the API (not filtered by protocol in the UI today).
- Backend model: **one protocol per constellation** (`Constellation.protocol`). UI should filter constellations by active page protocol when implementing [#277](https://github.com/pskillen/meshflow-ui/issues/277).

### Channels

| Protocol | Typical channels                                          | UI labelling                                                                         |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **MT**   | Often 1 primary (+ occasional second)                     | Channel `name`                                                                       |
| **MC**   | Many per constellation — **PUBLIC** and **HASHTAG** types | `display_label` or `#hashtag` via `formatMessageChannelLabel` (no device slot index) |

- Channel list: filtered with `filterChannelsForProtocol` (by `MessageChannel.protocol`).
- Legacy channels without `protocol` appear only on **Meshtastic** pages.
- Only **one channel** is loaded/displayed at a time; switching channel refetches/rebinds `MessageList`.
- `mc_channel_type` is not shown separately on the messages picker; hashtags appear as `#tag` when `display_label` / `mc_hashtag` are set.

### Multi-channel support summary

- **MT:** Multiple channels per constellation are supported in data and picker; UI still shows one at a time.
- **MC:** Same — adequate for 1–2 channels, awkward for ~10+ (dropdown scroll) — motivation for [#281](https://github.com/pskillen/meshflow-ui/issues/281).

## Message list and layout

### Conversation-style cards (not Discord-flat)

- Each message (or **group** of consecutive sends) is a bordered **card** (`MessageItem`), not a full-width flat log.
- Header row: avatar (first letter), sender name, relative timestamp, **heard** control.
- Body indented under avatar column (`pl-8`).

A **Discord-like** (non-bubble, dense, single-column) layout is **not** implemented; the current design is closer to compact chat bubbles/cards. Worth evaluating in a layout refresh (especially for MC volume).

### Consecutive message grouping

- Same sender key, within **15 minutes**, on the **main** timeline (not replies): rendered as one card.
- **MT:** `sender.node_id_str`.
- **MC channel text:** single `mc_sender_candidates` entry → that node’s `node_id_str`; multiple candidates → `mc-ambiguous:{label}` (same parsed name only).
- Primary message keeps full header; **continuations** appear below a divider with time + heard only (no repeated avatar row).

### Threading and reactions (Meshtastic-oriented)

| Feature                  | Behaviour                                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text replies**         | Rows with `reply_to_meshtastic_packet_id` and `is_emoji: false` render under parent as indented thread (`border-l-2`).                                                                                         |
| **Nested replies**       | **Not supported in UI** — only one level (parent main message → flat reply list). Deeper reply chains in API would still appear as top-level if they have no parent in the filtered set, or as orphan replies. |
| **Emoji reactions**      | Separate rows with `is_emoji: true`, same `reply_to_meshtastic_packet_id`. Grouped by emoji character; badge shows count + tooltip of sender names.                                                            |
| **Reactions on replies** | Grouped by parent `packet_id` of the **root** message only (replies don’t get their own emoji row in the tree).                                                                                                |
| **`packet_id`**          | Required for grouping; documented API dependency.                                                                                                                                                              |

MeshCore may not use MT reply/emoji semantics; UI still runs the same grouping logic if the API populates those fields.

### Timestamps

- Primary: `StaleReportedTime` (relative, e.g. “2h ago”) with `title` = absolute (`MMM d, yyyy h:mm a`).
- Continuations / inline replies: shorter absolute formats.
- Ordering: newest at top of list.

### Heard count (feeders / observers)

- Button: **`{count} heard`** opens dialog **“Message Heard By”**.
- **MT:** `PacketObservation` — observer short/long name, `node_id_str`, rx time, **Direct** vs **Hop: N**, RSSI/SNR.
- **MC:** `MeshCoreHeardObservation` — observer string (`node_id_str`), rx time, RSSI/SNR (no hop/direct badge).
- Shown on main messages, continuations, and inline replies (smaller button variant).

### Sender display and links

- **MT** `!hex` senders: name links to node detail (parsed from `node_id_str`).
- **MC channel text** (`sender` null): inferred via API `mc_sender_label` / `mc_sender_candidates` (`messageSenderDisplay`):
  - **0 candidates:** “Anonymous”, no link.
  - **1 candidate:** node name + link to MeshCore node detail.
  - **>1 candidates:** parsed label + “N matches” badge (tooltip lists candidate names); no link.
- **Mobile:** extra external-link icon on small screens when a link exists.

### Pagination

- Initial page size **25** on message history page (`MessageList` prop).
- **Load More** button at bottom (older messages).

## Realtime

| Context                            | Behaviour                                                              |
| ---------------------------------- | ---------------------------------------------------------------------- |
| On messages page, selected channel | New WS messages prepend if same `channel` id and protocol.             |
| On messages page, other channel    | WS message ignored for list (no background update for other channels). |
| Off messages page                  | Counted as unread (per protocol) + toast notification.                 |

WS handler does not check `constellation_id` on the payload (only channel id). REST queries use both `channel_id` and `constellation_id`.

## Unread / notification counts

See **[docs/features/messages/unread-count.md](../features/messages/unread-count.md)** ([#279](https://github.com/pskillen/meshflow-ui/issues/279): WS payloads omit `protocol`, so `messageProtocol()` defaults live traffic to Meshtastic).

### Implemented today

- **Protocol-scoped** unread array in `WebSocketProvider` (intended; classification broken until API sends `protocol` on WS).
- Sidebar **Messages** link per protocol: red badge with count (max display `9+`).
- Clearing: navigate to that protocol’s messages URL, or click nav link (explicit `markAsReadForProtocol` before navigate).
- **Global** `hasUnreadMessages` / `markAllAsRead` exist but nav uses per-protocol helpers.

### Not implemented

- Per-**channel** unread badges.
- Per-**constellation** aggregates.
- `localStorage` persistence of unread across reloads (unread is in-memory only).
- Distinction between “unread since last visit” vs total — current model is “messages received while not on that protocol’s page” until cleared.

User request: channel-level counts beside a future channel list, plus total on protocol nav link — aligns with extending `unreadMessages` indexing (channel + protocol keys).

## Default selection UX

- First constellation auto-selected when data loads ([#278](https://github.com/pskillen/meshflow-ui/issues/278) partially met).
- First **protocol-filtered** channel auto-selected after constellation change.
- No `localStorage` for last constellation/channel.
- Constellation picker remains a **dropdown** (not tabs/buttons).

## Other / latent features

| Feature                                        | Status                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| Filter by sender (`nodeId` / `sender_node_id`) | Hook/API support only; **not** wired on message history page              |
| Single message by id (`useMessage`)            | Available; no dedicated UI route                                          |
| `useConstellationChannels` hook                | Exists; message page uses nested channels on constellation object instead |
| MC channel sync / apply status                 | Node settings + API; **not** on messages page                             |
| Search within message history                  | **None**                                                                  |
| Jump to date / live tail                       | **None**                                                                  |
| Compose / send                                 | **Out of scope** (read-only history)                                      |

## Information priority (UI)

Matches the earlier product doc:

| Priority  | Content                           |
| --------- | --------------------------------- | ------------------- |
| Essential | Sender, body, timestamp           |
| Secondary | Emoji reactions, replies (inline) |
| Tertiary  | long_name, hop/direct detail      | Inside heard dialog |

`long_name` is not shown in the message header (only in heard dialog for MT observers).
