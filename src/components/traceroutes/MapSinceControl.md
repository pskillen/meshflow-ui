# MapSinceControl

## Purpose

The custom-range control for the heatmap and topology pages, placed in `StatsRangeBar`'s children slot. The shared bar has presets only.

## Props

- `since: Date | null` – active custom start date.
- `onChange(date: string | null)` – `YYYY-MM-DD`, or null to clear.

## Behaviour

- Button reads "Custom", or "Since 3 Nov 2026" when active, with an X to clear.
- Opens a dialog with one date input (not in the future). Apply writes the date; Cancel discards.
- Open-ended: the heatmap endpoint has no end bound, so there is no "to" date.

## Wiring

Used by `TracerouteHeatmapChrome`; state lives in [`useMapRange`](../../hooks/useMapRange.md) (`?since=`).

## Related

[`StatsRangeBar`](../stats/StatsRangeBar.md).
