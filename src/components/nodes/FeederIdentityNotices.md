# FeederIdentityNotices

## Purpose

Notices at the top of **My Nodes** that tell a feeder's owner when its Meshtastic node number changed (for example
after a Meshtastic 2.8 re-key), and let them act on it.

## What owners see

One alert per event, newest first. At most five are shown, followed by "and N more" if there are others.

| Case                                           | Look                             | Text                                                                                                                            | Buttons                                |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Updated automatically                          | Neutral, "Feeder number changed" | "(name) changed from !old to !new. It keeps its history and API key."                                                           | **Dismiss**, link to the feeder's page |
| Needs review                                   | Red, "Feeder needs review"       | "(name) reported !new but is stored as !old." plus one line giving the reason, and a note that packets are still being ingested | **Re-point to !new**, **Dismiss**      |
| Flagged with nothing to do, or changed by hand | Neutral                          | The change, with no action                                                                                                      | **Dismiss**                            |

Numbers are shown exactly as the API sends them (`!1234abcd`), never shortened.

### Reasons

- Automatic updates are off on this server.
- Its public key is also used by another node.
- Its public key has changed.
- Its number doesn't match its public key, so this may be a different radio.
- It didn't report a public key.
- Another feeder already uses that number. Contact an administrator. (No **Re-point** button in this case.)

### Re-point

**Re-point** opens a confirmation. Confirming asks the API to store the feeder under the number it now reports. If the
API refuses (for example another feeder took that number), its message is shown in the dialog and nothing changes.
On success the notice goes away and My Nodes refreshes.

**Dismiss** marks the event as seen, so it stops appearing.

## When nothing shows

The component renders nothing when there are no unacknowledged events, and also when the request fails, including on an
older API that doesn't have the endpoint yet. It never shows an error for that.

## Data

- `GET /nodes/managed-node-identity-events/?unacknowledged=true`
- `POST /nodes/managed-node-identity-events/{id}/acknowledge/`
- `POST /nodes/managed-nodes/{internal_id}/repoint-meshtastic-id/`

Hooks: `src/hooks/api/useFeederIdentityEvents.ts`. Both actions refresh the event list and My Nodes' managed nodes.
