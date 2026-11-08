# FirmwareBadge

## Purpose

`FirmwareBadge` shows the firmware generation the API inferred for an observed Meshtastic node. `FeederFirmware` shows the firmware version a feeder (managed node) reported itself. Use the badge on node detail; use `FeederFirmware` in the managed nodes table.

## Props / inputs

- `FirmwareBadge`: `node` with `protocol`, `inferred_firmware`, `inferred_firmware_basis` (from `ObservedNode`).
- `FeederFirmware`: `node` with `reported_firmware_version`, `firmware_reported_at` (from `ManagedNode`).
- `hasFirmwareBadge(node)` (in `src/lib/firmware.ts`): true when the badge would render; callers use it to avoid an empty "Firmware:" row.

## Behaviour

| Input                                          | Shown                       |
| ---------------------------------------------- | --------------------------- |
| MeshCore (`protocol === 2`)                    | nothing                     |
| `inferred_firmware` undefined (older API)      | nothing                     |
| `null`                                         | `Unknown`                   |
| `"2.7"`                                        | `2.7 or earlier (inferred)` |
| `"2.8"`, basis `key_identity` / `predicted_id` | `2.8+ (inferred)`           |
| basis `feeder_report`                          | `2.8+ (reported)`           |
| later generation or unrecognised basis         | `<gen>+ (inferred)`         |

Why: `2.7` is the lowest generation the API reports and means "2.7 or earlier", so it is the only value without `+`. `2.8+` means a 2.8 identity was seen, so the node is at least that new. `Unknown` means there is no evidence, not that the node is old. Only a feeder report reads "reported"; everything else is an inference. The UI never says "assumed".

`FeederFirmware` shows `—` when nothing was reported, otherwise the version with a `StaleReportedTime` line, like the Bot version cell.

## Wiring

- `NodeDetailContent` ("Basic Information" card, below Hardware Model) renders `FirmwareBadge` when `hasFirmwareBadge` is true.
- `ManagedNodesStatus` has a `Firmware` column after `Bot version` (not for MeshCore) rendering `FeederFirmware`.

## Related

- API contract: epic `pskillen/meshflow-api#437`, ticket ui#398.
- `ProtocolBadge`, `StaleReportedTime`.
