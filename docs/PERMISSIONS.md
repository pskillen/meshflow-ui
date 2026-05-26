# UI permissions and routes

Parent API epic: [meshflow-api #346](https://github.com/pskillen/meshflow-api/issues/346). UI work: [#298](https://github.com/pskillen/meshflow-ui/issues/298).

API contract: [meshflow-api `docs/permissions/README.md`](https://github.com/pskillen/meshflow-api/blob/main/docs/permissions/README.md).

## Route matrix

| Route                                                                                                       | Guest (logged out) | User (JWT) | Notes                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------------------------------------- |
| `/`, `/nodes`, `/nodes/:id`                                                                                 | yes                | yes        | Map on list page; detail redacted for guests |
| `/map`                                                                                                      | yes                | yes        | Redirects to `/nodes`                        |
| `/messages`, `/meshcore/messages`                                                                           | yes                | yes        |                                              |
| `/traceroutes/*` (read pages)                                                                               | yes                | yes        | Trigger UI needs feeder                      |
| `/login`, `/auth/callback`                                                                                  | yes                | yes        |                                              |
| `/nodes/:id/claim`, `/nodes/my-nodes`                                                                       | no                 | yes        | Protected                                    |
| `/user/*`, `/nodes/monitor`, `/nodes/dx-monitoring`                                                         | no                 | yes        | Protected                                    |
| `/nodes/infrastructure`, `/meshcore/infrastructure`, `/nodes/infrastructure/export`, `/nodes/managed-nodes` | no                 | feeder+    | Protected; operator pages                    |
| `/user/api-keys`                                                                                            | no                 | feeder+    | Protected                                    |

## Implementation

- **Public routes** use `AppLayout` without `ProtectedRoute` ([`src/App.tsx`](../src/App.tsx)).
- **Protected routes** wrap `AppLayout` in `ProtectedRoute`.
- **API client** ([`src/lib/api/base.ts`](../src/lib/api/base.ts)): anonymous `GET` without a token does not force login redirect on 401.
- **Playwright**: `VITE_BROWSER_TEST=true` still bypasses auth in `ProtectedRoute` ([`docs/TESTING.md`](TESTING.md)).

## Follow-ups

- Login CTAs on claim, watches, traceroute trigger for non-feeder users.
- E2E test with real anonymous session (no `VITE_BROWSER_TEST`).
