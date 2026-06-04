# Messages UI

Documentation for the Meshflow UI **text message history** experience (Meshtastic and MeshCore). Use this as the baseline before implementing navigation, channel picker, and layout upgrades ([#277](https://github.com/pskillen/meshflow-ui/issues/277), [#278](https://github.com/pskillen/meshflow-ui/issues/278), [#281](https://github.com/pskillen/meshflow-ui/issues/281); parent epic [meshflow-api#341](https://github.com/pskillen/meshflow-api/issues/341)).

**Feature docs (new):** [docs/features/messages/](../features/messages/README.md) — hub including dedicated [unread-count.md](../features/messages/unread-count.md) ([#279](https://github.com/pskillen/meshflow-ui/issues/279)).

## Contents

| Doc                                                  | Purpose                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Feature hub](../features/messages/README.md)        | Unread badges, cross-links to API                                                           |
| [Unread count](../features/messages/unread-count.md) | Nav badges, `WebSocketProvider`, [#279](https://github.com/pskillen/meshflow-ui/issues/279) |
| [Architecture](./architecture.md)                    | Routes, components, hooks, API/WS integration                                               |
| [Current features](./current-features.md)            | Reverse-engineered behaviour today (grouping, layout, unread, realtime)                     |
| [Gaps and roadmap](./gaps-and-roadmap.md)            | Known gaps, issue mapping, design directions                                                |

## Product summary

- **Two protocol-scoped pages** share one implementation: `ProtocolMessageHistoryPage` with `MESHTASTIC_CONFIG` or `MESHCORE_CONFIG`.
- **Single active channel** at a time: constellation + channel `<select>` dropdowns, then `MessageList` for that channel.
- **Meshtastic** typically has 1–2 channels per constellation; **MeshCore** often has ~10+ (public + hashtag channels per region).
- **Unread** is tracked per protocol in the sidebar (not per channel). Realtime prepend applies only to the **currently selected** channel.

## Source map (quick)

| Area             | Path                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Pages            | `src/pages/messages/MessageHistory.tsx`, `src/pages/meshcore/MeshCoreMessages.tsx`, `src/pages/protocol/ProtocolMessageHistoryPage.tsx` |
| List / item      | `src/components/messages/MessageList.tsx`, `MessageItem.tsx`                                                                            |
| Protocol helpers | `src/lib/message-protocol.ts`, `src/lib/message-channels.ts`, `src/lib/mesh-protocol.ts`                                                |
| Data             | `src/hooks/api/useMessages.ts`, `src/hooks/useMessagesWithWebSocket.ts`, `src/hooks/api/useConstellations.ts`                           |
| Realtime / nav   | `src/providers/WebSocketProvider.tsx`, `src/components/nav-main.tsx`                                                                    |

## Related API / backend docs

- [meshflow-api text-messages feature](https://github.com/pskillen/meshflow-api/blob/main/docs/features/text-messages/README.md) — REST + WS; [unread-count](https://github.com/pskillen/meshflow-api/blob/main/docs/features/text-messages/unread-count.md) (WS `protocol` gap)
- OpenAPI: `GET /api/messages/text/` (`channel_id`, `constellation_id`, `protocol`, `sender_node_id`, pagination)
- WebSocket: `/ws/messages/?token=…` — pushes `TextMessage` payloads (narrower than REST today)
- Constellations/channels: `Constellation.protocol`, `MessageChannel.protocol`, `display_label`, `mc_channel_type` ([meshflow-api text-message-channels](https://github.com/pskillen/meshflow-api/blob/main/docs/features/meshcore/text-message-channels.md))
