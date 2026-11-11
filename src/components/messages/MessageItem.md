# MessageItem

## Purpose

One text message in the message history: sender header, text, emoji reactions, inline replies and continuation messages, plus the **heard** control that opens the "Message Heard By" dialog.

## Props

`message`, `replies?`, `emojiReactions?`, `continuationMessages?`.

## Heard-by dialog

Opened from the `{count} heard` button. For Meshtastic it shows the path map and one row per observing feeder: name, receive time, and a hop label on the right. For MeshCore it shows the heard paths panel instead (no hop label).

The hop label comes from `describeHops` in `src/lib/hop-display.ts`. The label is a focusable badge; its explanation shows as a tooltip on hover or keyboard focus.

| Observation                                                | Label                  | Explanation                                                  |
| ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------------ |
| Heard straight from the sender                             | Direct (with RSSI/SNR) | no relay in between                                          |
| Connect-time replay by the feeder                          | Replayed by the feeder | not heard over the air just now                              |
| Known hop count                                            | Hops: N                | how many relays it passed through                            |
| No hop count, MQTT flag set or a transport other than LoRa | Via internet           | reached the feeder over MQTT or the network, so no hop count |
| No hop count otherwise                                     | Hops unknown           | the packet did not say how far it travelled                  |

Older APIs omit `replayed`, `via_mqtt` and `transport_mechanism`; the helper then falls back to "Hops: N" or "Hops unknown".

## Related

[`HeardPathMap.md`](./HeardPathMap.md), [`HeardPathGeoMap.md`](./HeardPathGeoMap.md), `docs/messages/current-features.md`.
