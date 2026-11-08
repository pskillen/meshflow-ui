# ApiKeysPage

## Purpose

The page at `/user/api-keys` where a user creates, activates, deactivates and deletes the API keys their bots use to
report packets and receive commands, and links each key to a managed node (the "feeder").

## The one-feeder rule

A key feeds one radio. The meshflow API refuses to link a second feeder to a key (HTTP 400, code
`api_key_already_linked`), so the UI matches:

- The **Assign Feeder** modal shows radio buttons, one per managed node in the key's constellation, plus **None**. It
  is never a multi-select.
- Help text: "One feeder per key. To feed from another radio, create another key." A feeder may still hold more than one
  key.
- **Save** swaps feeders by removing the old link first, then adding the new one (adding first would fail while the old
  link is still there). Choosing **None** just removes the link.
- If the API rejects a change (create or assign), the API's own `error` text is shown, in the modal for assignment. If
  the add fails after the remove, the key is left unlinked and the list is refreshed to show that.

## Shared (legacy) keys

Keys created before the rule can still be linked to several feeders and keep working on older bots. Such a key shows a
**Shared (legacy)** badge with the note "Works on older bots only. Create one key per feeder."

For a shared key the modal lists its linked feeders read-only, each with a **Remove** button, and shows no picker and no
Save button. Once one feeder is left the normal picker appears with that feeder selected, so Save changes nothing unless you pick another. A single linked feeder outside your own list is shown as "Currently linked feeder (not in your list)". Owners can thin a shared key down but never grow it.

## Data

- Keys: `useQuery(['api-keys'])` via `MeshtasticApi.getApiKeys`.
- Managed nodes and constellations: `useMyManagedNodesSuspense`, `useConstellationsSuspense`.
- Links: `apiKeyLinkedInternalIds` in `src/lib/managed-node-enrollment.ts`; writes via `addNodeToApiKey` and
  `removeNodeFromApiKey`.

## Related

- Tests: `ApiKeysPage.test.tsx`.
- Bot setup instructions live in Node Settings, under Managed Nodes.
