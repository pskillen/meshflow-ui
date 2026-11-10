# HeardTruncatedNotice

## Purpose

One-line status message shown under the layer pills when the Heard layer holds only the first page of the nodes heard in the window.

## Props

- `shown`: how many nodes the layer loaded.
- `total`: how many nodes were heard in the window.
- `since`: start of the window, shown as a date.

## Behaviour

- Renders a `role="status"` paragraph: "Heard layer shows the first X of N nodes heard since <date>".
- The pages render it only when the Heard layer is on and `useObservedNodesHeard` reports `truncated`.

## Wiring

Used by `ConstellationCoveragePage` and `FeederCoveragePage`.
