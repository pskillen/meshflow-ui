# FeederIdentityNotices

## Purpose

Notices at the top of **My Nodes** that tell a feeder's owner when its Meshtastic node number changed (for example
after a Meshtastic 2.8 re-key), and let them act on it.

## Props

`ownedManagedNodeIds`: internal ids of the user's own managed nodes (My Nodes passes them from its managed-node list).
Only events for those feeders are shown, because the API returns every owner's events to staff.

## What owners see

One alert per event, newest first. At most five are shown, followed by "and N more" (counting events beyond the first
page of results too). Neutral notices are `role="status"`; the red one is `role="alert"`.

| Case                    | Look                                                                          | Text                                                                                                                                                                                                   | Buttons                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Updated automatically   | Neutral, "Feeder number changed"                                              | "(name) changed from !old to !new. It keeps its history and API key."                                                                                                                                  | **Dismiss**, link to the feeder's page (new number)                                       |
| Changed by hand         | Neutral, "Feeder number changed"                                              | "(name) changed from !old to !new."                                                                                                                                                                    | **Dismiss**, link (new number)                                                            |
| Needs review            | Red border, icon and title; body in normal text colour. "Feeder needs review" | "(name) reported !new but is stored as !old." (or "reported a different public key for !X." when the number is the same), one line giving the reason, and a note that packets are still being ingested | **Re-point to !new**, **Dismiss**, link (old number: the feeder is still stored under it) |
| Flagged, since resolved | Neutral, "Feeder review resolved"                                             | "A number change for (name) (!old to !new) was flagged for review and has since been resolved."                                                                                                        | **Dismiss**, link (old number)                                                            |

Numbers are shown exactly as the API sends them (`!1234abcd`), never shortened.

### Reasons

- Automatic updates are off on this server.
- Its public key is also used by another node.
- Its public key has changed. You can't re-point it yourself. Contact an administrator. (No **Re-point** button.)
- Its number doesn't match its public key, so this may be a different radio. You can't re-point it yourself. Contact an administrator. (No **Re-point** button.)
- It didn't report a public key.
- Another feeder already uses that number. Contact an administrator. (No **Re-point** button in this case.)

### Re-point

**Re-point** opens a confirmation. Confirming asks the API to store the feeder under the number it now reports. If the
API refuses, a plain message is shown in the dialog and nothing changes:

- `403 repoint_not_proven`: the number can't be confirmed from the feeder's stored public key; contact an administrator.
- `409 repoint_target_key_mismatch`: another node uses that number with a different public key.
- `409 repoint_target_claimed`: that number belongs to another user.
- `409 number_collision`: another feeder already uses that number.

Any other refusal shows the API's own text. The API client turns failures into `{ message, status, data }`, so the
code and text are read from `data`. Confirm is guarded against double-clicks (one request is sent).
On success the notice goes away and My Nodes refreshes.

**Dismiss** marks the event as seen, so it stops appearing. It is also guarded against double-clicks; if it fails, the
notice stays and says "Could not dismiss this notice. Try again."

A dismissed notice that still needed review has no way back in this UI yet.

## When nothing shows

The component renders nothing when there are no unacknowledged events, and also when the request fails, including on an
older API that doesn't have the endpoint yet. It never shows an error for that.

## Data

- `GET /nodes/managed-node-identity-events/?unacknowledged=true`
- `POST /nodes/managed-node-identity-events/{id}/acknowledge/`
- `POST /nodes/managed-nodes/{internal_id}/repoint-meshtastic-id/`

Hooks: `src/hooks/api/useFeederIdentityEvents.ts`. Both actions refresh the event list and My Nodes' managed nodes.
