# MapInfoButton

## Purpose

Moves a map page's long description out of the page so the map gets the space. An outline icon button (`aria-label="About this map"`) opens a `Dialog` (there is no Popover primitive in `src/components/ui/`, and a dialog works on touch).

## Props

- `title` – dialog title.
- `children` – the description content.

## Wiring

`FeederCoveragePage` and `ConstellationCoveragePage`, in the range bar's children slot.
