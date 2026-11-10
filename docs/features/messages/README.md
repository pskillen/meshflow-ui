# Messages UI (feature docs)

Documentation for the Meshflow SPA **text message history** experience (Meshtastic and MeshCore): routes, realtime, and navigation unread badges. Use this tree for feature-level behaviour; older narrative docs also live under [`docs/messages/`](../../messages/README.md) (architecture, roadmap).

**Backend counterpart:** [meshflow-api `docs/features/text-messages/`](https://github.com/pskillen/meshflow-api/blob/main/docs/features/text-messages/README.md)

**Epic:** [meshflow-api#341](https://github.com/pskillen/meshflow-api/issues/341) — messages UI rework ([#277](https://github.com/pskillen/meshflow-ui/issues/277), [#278](https://github.com/pskillen/meshflow-ui/issues/278), [#281](https://github.com/pskillen/meshflow-ui/issues/281)).

## Implementation status

| Area                                                      | Status  | Notes                                                                                                                                         |
| --------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Protocol-scoped pages (`/messages`, `/meshcore/messages`) | Shipped | Shared `ProtocolMessageHistoryPage`                                                                                                           |
| REST history + pagination                                 | Shipped | `useMessages` / `useMessagesSuspense`                                                                                                         |
| WS live prepend on active channel                         | Shipped | `useMessagesWithWebSocket`                                                                                                                    |
| Sidebar unread badge per protocol                         | Shipped | Server-seeded totals + WS ([#422](https://github.com/pskillen/meshflow-ui/issues/422))                                                        |
| Per-channel unread on messages page                       | Shipped | Active constellation only — [meshflow-api#396](https://github.com/pskillen/meshflow-api/issues/396)                                           |
| Channel selector button row                               | Shipped | Interim until [#281](https://github.com/pskillen/meshflow-ui/issues/281)                                                                      |
| Persisted unread                                          | Shipped | Per-user read cursors in the API ([meshflow-api#527](https://github.com/pskillen/meshflow-api/pull/527)); falls back to WS-only on older APIs |

## Documentation map

| Doc                                                                      | Purpose                                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [unread-count.md](unread-count.md)                                       | Nav badges, `WebSocketProvider`, mark-as-read, [#279](https://github.com/pskillen/meshflow-ui/issues/279) |
| [../../messages/architecture.md](../../messages/architecture.md)         | Routes, components, hooks (broader)                                                                       |
| [../../messages/current-features.md](../../messages/current-features.md) | List layout, grouping, heard dialog                                                                       |
| [../../messages/gaps-and-roadmap.md](../../messages/gaps-and-roadmap.md) | Issue mapping, planned UX                                                                                 |

## Concepts

- **Protocol slug** — `'meshtastic' | 'meshcore'` in UI; maps from API `protocol` string or legacy numeric `1`/`2`.
- **Unread** — seeded from `GET /api/messages/unread-counts/`, WS frames add on top (deduped by id); nav sums per protocol; channel buttons per channel id. Viewing a channel marks only that channel read.
- **On messages page** — only the **viewed channel** is read (`setActiveMessagesView`, mark-read up to the newest message shown); other channels still badge; toast suppressed for that protocol’s route only.

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
