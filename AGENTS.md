# Meshflow UI – Agent Context

React SPA frontend for the Meshflow system. Displays and manages a country-wide mesh of Meshtastic nodes. Works with the meshflow-api Django backend.

## Project Structure

```
src/
├── main.tsx, App.tsx          # Entry point, routing
├── pages/                     # Route pages
│   ├── Dashboard.tsx          # Home: recent node counts, constellation map, packet stats
│   ├── nodes/                 # NodesList, NodeDetails, ClaimNode, MyNodes, monitor
│   ├── messages/              # MessageHistory
│   ├── map/                   # NodeMap
│   ├── traceroutes/           # TracerouteStatsPage, TracerouteHistory, heatmap/coverage pages
│   ├── user/                  # UserPage, NodeSettings
│   └── auth/                  # LoginPage, OAuthCallback
├── components/                # Reusable UI
│   ├── ui/                    # shadcn/ui primitives
│   ├── nodes/                 # NodeCard, NodesMap, ConstellationsMap, etc.
│   └── messages/              # MessageList, MessageItem
├── hooks/                     # React hooks
│   └── api/                   # useNodes, useNodesSuspense, useRecentNodeCountsSuspense, etc.
├── lib/                       # Core utilities
│   ├── api/                   # MeshtasticApi, base, api-utils
│   ├── auth/                  # authService
│   ├── models.ts              # TypeScript models (ObservedNode, ManagedNode, etc.)
│   └── types.ts               # API types (PaginationParams, DateRangeParams)
└── providers/                 # AuthProvider, ConfigProvider, WebSocketProvider
```

## Key Concepts

- **ObservedNode**: Node seen on the mesh. Has `last_heard`, `node_id_str`, `latest_position`, `latest_device_metrics`.
- **ManagedNode**: Meshtastic radio node, ppart of the MeshFlow infrastructure. Reports packets to central API.
- **Constellation**: Regional subset of nodes. Used for grouping on maps and message channels.
- **Recent nodes**: UI focuses on "recently seen" nodes; time ranges: 2h, 24h, 7d, 30d, all time.

## API Integration

- **Base**: `src/lib/api/base.ts` – axios instance, auth interceptors
- **API class**: `src/lib/api/meshtastic-api.ts` – `getNodes`, `getRecentNodeCounts`, `getNode`, `searchNodes`, etc.
- **Hooks**: `src/hooks/api/useNodes.ts` – `useNodesSuspense`, `useRecentNodeCountsSuspense`, `useNodes`
- **Query keys**: Include `lastHeardAfter` rounded to 5 minutes for stable cache keys (avoids Suspense remount loops)

## Development

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest
```

## Tech Stack

- React 18, TypeScript, Vite
- React Router 7
- TanStack Query (React Query)
- Tailwind CSS, shadcn/ui (Radix)
- Leaflet (maps), Recharts/ApexCharts (charts)
- date-fns

## Conventions

- Use `useNodesSuspense` / `useRecentNodeCountsSuspense` inside `<Suspense>` boundaries.
- Time-based node queries: pass `lastHeardAfter: Date` to filter; use rounded keys for cache stability.
- Pages under `src/pages/`; shared components under `src/components/`.
- API config: `config.ts` + remote `config.json`; `MESHFLOW_API_URL` for backend base URL.

### Component and screen documentation

When you **create** a non-trivial component or page screen, or **meaningfully change** one you touch, add or update a sibling markdown file next to the main `.tsx` (same basename, e.g. `HeardPathMap.tsx` → `HeardPathMap.md`).

Do **not** backfill docs for the whole codebase in one go; only document what you are working on so behaviour stays accurate.

Each doc should explain, in plain language:

- **Purpose** — what the UI is for and when to use it vs similar components (e.g. `HeardPathMap` vs `HeardPathGeoMap`).
- **Props / inputs** — main types and what drives rendering.
- **Behaviour** — what is drawn or shown, empty states, warnings, and non-obvious rules (maps, dialogs, protocol splits).
- **Wiring** — where it is used in the app and which adapters/hooks feed it.
- **Related** — links to paired components, feature docs under `docs/`, or API contracts when relevant.

Examples: [`src/components/messages/HeardPathMap.md`](src/components/messages/HeardPathMap.md), [`src/components/messages/HeardPathGeoMap.md`](src/components/messages/HeardPathGeoMap.md).

## Configuration

- Default config in `config.ts`
- Overridable via remote `config.json`
- API base URL and auth configured per environment

## Source control

When asked to create a pull request description, follow the template at
.github/pull_request_template.md, and output a markdown file named `tmp/PR.md`

## Plan mode

When creating a plan, Include that we should branch from the latest origin/main, do the work, commit, push, and open a PR. Use the github-personal MCP. the gh
command is not available, do not use it.
