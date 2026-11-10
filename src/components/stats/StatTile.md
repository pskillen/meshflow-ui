# StatTile

## Purpose

A generic stat tile: a small label, a large value and optional subtext. It holds no node-count logic, so other stats screens can reuse it. Use `RightNowBand` for the node-activity band, not a hand-built row of tiles.

## Props

- `label: string`, `value: ReactNode`, `sub?: ReactNode` (one or more small lines under the value).
- `hero?: boolean` – stronger border for the headline tile in a group.
- `role?` – e.g. `listitem` when the tiles sit in a `role="list"` group.
- `className?`, `data-testid?`.

## Behaviour

Presentational only. Numbers use tabular figures. The caller formats values.

## Wiring

Used by `RightNowBand` only.

## Related

- [`RightNowBand`](RightNowBand.md)
