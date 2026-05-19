import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

import type { Layer, PickingInfo } from '@deck.gl/core';
import { DeckGL } from 'deck.gl';
import type { DeckGLProps } from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Map } from 'react-map-gl/mapbox';

import { useConfig } from '@/providers/ConfigProvider';
import { useMapboxStyle } from '@/hooks/useMapboxStyle';
import { cn } from '@/lib/utils';

/** Move Mapbox popups to the deck.gl wrapper so they stack above the WebGL canvas (@deck.gl/react forces Map to z-index -1). */
function reparentMapboxPopupsIntoDeckWrapper(root: HTMLElement) {
  const deckWrap =
    root.querySelector<HTMLElement>('#deckgl-wrapper') ?? root.querySelector<HTMLElement>('[id$="deckgl-wrapper"]');
  if (!deckWrap) return;
  const popups = root.querySelectorAll<HTMLElement>('.mapboxgl-popup');
  popups.forEach((popup) => {
    if (popup.parentElement !== deckWrap) {
      deckWrap.appendChild(popup);
    }
  });
}

/** DeckGL `initialViewState` (longitude, latitude, zoom, etc.). */
export type DeckMapboxInitialViewState = NonNullable<DeckGLProps['initialViewState']>;

export type DeckMapboxMapProps = {
  layers: Layer[];
  initialViewState: DeckMapboxInitialViewState;
  onClick?: (info: PickingInfo) => void;
  /** Fires on pan/zoom; use for zoom-dependent overlays (e.g. labels). */
  onViewStateChange?: DeckGLProps['onViewStateChange'];
  getTooltip?: DeckGLProps['getTooltip'];
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
  /**
   * Reparent `.mapboxgl-popup` nodes into the deck.gl root so popups render above deck layers.
   * Disable only if you hit positioning issues with a custom Mapbox integration.
   */
  elevateMapboxPopups?: boolean;
};

/**
 * Deck.gl owns the WebGL overlay lifecycle; Mapbox renders underneath as a child Map.
 * Replaces fragile `useControl(() => new MapboxOverlay(props))` + render-time `setProps`,
 * which could drop layers after unrelated React state updates (GitHub #150).
 */
export function DeckMapboxMap({
  layers,
  initialViewState,
  onClick,
  onViewStateChange,
  getTooltip,
  children,
  className,
  'data-testid': testId,
  elevateMapboxPopups = true,
}: DeckMapboxMapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const config = useConfig();
  const mapboxToken = config.mapboxToken ?? (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined);
  const mapStyle = useMapboxStyle();

  useLayoutEffect(() => {
    if (!mapboxToken || !elevateMapboxPopups) return;
    const root = rootRef.current;
    if (!root) return;
    const run = () => reparentMapboxPopupsIntoDeckWrapper(root);
    run();
    const raf = requestAnimationFrame(run);
    const t = window.setTimeout(run, 0);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [mapboxToken, elevateMapboxPopups, children]);

  if (!mapboxToken) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
        Mapbox token required. Set VITE_MAPBOX_TOKEN (dev) or MAPBOX_TOKEN (Docker) in your environment.
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative h-full w-full', className)} data-testid={testId}>
      <DeckGL
        controller
        layers={layers}
        initialViewState={initialViewState}
        onClick={onClick}
        onViewStateChange={onViewStateChange}
        getTooltip={getTooltip}
        style={{ width: '100%', height: '100%', minHeight: '200px', minWidth: '0' }}
      >
        <Map
          reuseMaps={false}
          mapboxAccessToken={mapboxToken}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%', minHeight: '200px', minWidth: '0' }}
        >
          {children}
        </Map>
      </DeckGL>
    </div>
  );
}
