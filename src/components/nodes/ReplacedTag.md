# ReplacedTag

## Purpose

A small tag, "Replaced → !8959691b", for a node whose radio now uses another number. The id links to the new node (`nodeDetailPath`; MeshCore ids work). Used wherever a node appears in a list so nobody mistakes the old one for live.

## Props

- `replacedBy`: the `replaced_by` object from the API (`NodeIdentityRef`); `null` or `undefined` renders nothing.
- `label`: `"Replaced"` (default, with an arrow) or `"Replaced by"` (My nodes card).
- `className`.

## Behaviour

The link stops click propagation so a tag inside a clickable row opens the new node, not the row's target. It is a real link, so it is keyboard reachable.

## Used by

`NodeSearch`, `NodesTable`, `MyNodeCard`. See [node identity](../../../docs/features/node-identity/README.md). Tests: `ReplacedTag.test.tsx`.
