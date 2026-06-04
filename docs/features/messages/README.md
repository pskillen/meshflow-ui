# Messages UI (feature docs)

Documentation for the Meshflow SPA **text message history** experience (Meshtastic and MeshCore): routes, realtime, and navigation unread badges. Use this tree for feature-level behaviour; older narrative docs also live under [`docs/messages/`](../../messages/README.md) (architecture, roadmap).

**Backend counterpart:** [meshflow-api `docs/features/text-messages/`](https://github.com/pskillen/meshflow-api/blob/main/docs/features/text-messages/README.md)

**Epic:** [meshflow-api#341](https://github.com/pskillen/meshflow-api/issues/341) — messages UI rework ([#277](https://github.com/pskillen/meshflow-ui/issues/277), [#278](https://github.com/pskillen/meshflow-ui/issues/278), [#281](https://github.com/pskillen/meshflow-ui/issues/281)).

## Implementation status

| Area                                                      | Status          | Notes                                                                                            |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| Protocol-scoped pages (`/messages`, `/meshcore/messages`) | Shipped         | Shared `ProtocolMessageHistoryPage`                                                              |
| REST history + pagination                                 | Shipped         | `useMessages` / `useMessagesSuspense`                                                            |
| WS live prepend on active channel                         | Shipped         | `useMessagesWithWebSocket`                                                                       |
| Sidebar unread badge per protocol                         | Shipped in code | **Bug [#279](https://github.com/pskillen/meshflow-ui/issues/279)** — WS payloads lack `protocol` |
| Per-channel / persisted unread                            | Not implemented | In-memory session only                                                                           |

## Documentation map

| Doc                                                                      | Purpose                                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [unread-count.md](unread-count.md)                                       | Nav badges, `WebSocketProvider`, mark-as-read, [#279](https://github.com/pskillen/meshflow-ui/issues/279) |
| [../../messages/architecture.md](../../messages/architecture.md)         | Routes, components, hooks (broader)                                                                       |
| [../../messages/current-features.md](../../messages/current-features.md) | List layout, grouping, heard dialog                                                                       |
| [../../messages/gaps-and-roadmap.md](../../messages/gaps-and-roadmap.md) | Issue mapping, planned UX                                                                                 |

## Concepts

- **Protocol slug** — `'meshtastic' | 'meshcore'` in UI; maps from API `protocol` string or legacy numeric `1`/`2`.
- **Unread** — messages received over WS while the user is **not** on that protocol’s messages route; stored in React state, not `localStorage`.
- **On messages page** — WS still fires, but `WebSocketProvider` does not add to unread; `useMessagesWithWebSocket` may prepend if channel + protocol match.

## Source map

| Area             | Path                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Pages            | `src/pages/messages/MessageHistory.tsx`, `src/pages/meshcore/MeshCoreMessages.tsx`, `src/pages/protocol/ProtocolMessageHistoryPage.tsx` |
| List / item      | `src/components/messages/MessageList.tsx`, `MessageItem.tsx`                                                                            |
| Protocol helpers | `src/lib/message-protocol.ts`, `src/lib/message-channels.ts`                                                                            |
| Data             | `src/hooks/api/useMessages.ts`, `src/hooks/useMessagesWithWebSocket.ts`                                                                 |
| Realtime / nav   | `src/providers/WebSocketProvider.tsx`, `src/components/nav-main.tsx`                                                                    |
| WS client        | `src/lib/websocket/websocketService.ts`                                                                                                 |

## Related API

- `GET /api/messages/text/` — `protocol`, `channel_id`, `constellation_id`
- `WS /ws/messages/?token=…` — see [API unread-count doc](https://github.com/pskillen/meshflow-api/blob/main/docs/features/text-messages/unread-count.md)
