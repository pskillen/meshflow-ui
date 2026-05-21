# Messages Page

The Messages pages display mesh text messages from the Meshflow network. Users view messages by channel within a constellation.

## Routes

- **Meshtastic:** `/messages` — channel filter with `protocol=meshtastic` on the API
- **MeshCore:** `/meshcore/messages` — channel filter with `protocol=meshcore`; channel labels may include `mc_channel_idx`

## Layout

### Compact Message Design

Each message uses a compact layout to fit more content on screen and reduce scrolling:

- **Header (single row)**: Avatar, sender name, relative time (e.g. "2h ago"), "x heard" button (inline)
- **Body**: Message text, emoji reactions (inline badges), replies (indented with left border)

Consecutive messages from the same sender within 15 minutes are combined into a single block, with older messages shown below a divider.

### Information Priority

| Priority  | Content                                      | Notes            |
| --------- | -------------------------------------------- | ---------------- |
| Essential | Sender, message text, timestamp              | Always visible   |
| Secondary | Emoji reactions, replies                     | Inline, compact  |
| Tertiary  | long_name, node_id_str, "heard" observations | In overflow menu |

### Node Links (Meshtastic)

- **Desktop**: Sender name is a link to the node's details page (`/nodes/{nodeId}`) when `node_id_str` is Meshtastic `!hex`
- **Mobile**: Sender name + small external-link icon
- **MeshCore:** `mc:` or anonymous senders show a label without a node link

Node ID is derived from `node_id_str` (e.g. `!a1b2c3d4` → parsed as hex to numeric ID).

## Emoji Reactions

Emoji reactions are stored as separate messages with `is_emoji: true` and `reply_to_meshtastic_packet_id` pointing to the parent message's `packet_id`. The UI groups them by parent and displays counts (e.g. "👍 3") with a tooltip listing who reacted.

**API requirement**: The messages API must return `packet_id` for grouping to work.

## Heard observations

- **Meshtastic:** `heard` entries use `PacketObservation` with observer node details, direct/hop, RSSI/SNR
- **MeshCore:** `heard` entries use observer `node_id_str` string plus RSSI/SNR

## Unread badges

WebSocket `MESSAGE_RECEIVED` events increment a protocol-scoped unread count when the user is not on that protocol's messages page. Nav **Messages** links (Meshtastic and MeshCore) show a red badge; visiting the matching page clears only that protocol's unread list.

## Related

- API: `GET /api/messages/text/` with `channel_id`, `constellation_id`, `protocol`
- WebSocket: Real-time message updates when connected; payload includes `protocol`
