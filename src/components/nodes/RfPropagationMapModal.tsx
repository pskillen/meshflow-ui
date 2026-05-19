/**
 * Dialog with Leaflet map + imageOverlay for a completed RF propagation render.
 * Two modes: fetch by `nodeId` when opened (infrastructure cards), or pass `assetUrl` + `bounds`
 * from a parent that already has the data (node details maximise — no refetch).
 * Uses high z-index / min-height pattern so tiles stack correctly in Radix Dialog.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RfPropagationMap } from '@/components/nodes/RfPropagationMap';
import { useRfPropagation } from '@/hooks/api/useRfPropagation';
import { isRfPropagationNone } from '@/lib/models';
import { cn } from '@/lib/utils';

export type RfPropagationMapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type RfPropagationMapModalLayout = 'default' | 'maximised';

export type RfPropagationMapModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When both are set, the modal uses this render directly and does not refetch. */
  assetUrl?: string | null;
  bounds?: RfPropagationMapBounds | null;
  /** When not using inline `assetUrl` + `bounds`, fetch propagation for this node while open. */
  internalId?: string;
  shortLabel?: string | null;
  /** Larger dialog for node-details maximise. */
  layout?: RfPropagationMapModalLayout;
};

export function RfPropagationMapModal({
  open,
  onOpenChange,
  internalId,
  assetUrl,
  bounds,
  shortLabel,
  layout = 'default',
}: RfPropagationMapModalProps) {
  const hasInlineRender = Boolean(assetUrl && bounds);
  const fetchEnabled = open && internalId != null && internalId.length > 0 && !hasInlineRender;
  const { data, isLoading } = useRfPropagation(internalId ?? '', { enabled: fetchEnabled });

  const readyFromQuery = data && !isRfPropagationNone(data) && data.status === 'ready' ? data : null;
  const mapAsset = hasInlineRender ? assetUrl! : readyFromQuery?.asset_url;
  const mapBounds = hasInlineRender ? bounds! : (readyFromQuery?.bounds ?? null);

  const showLoading = fetchEnabled && isLoading;
  const showMap = Boolean(mapAsset && mapBounds);
  const showEmpty = !showLoading && !showMap;

  const isMaximised = layout === 'maximised';
  const mapMinHeight = isMaximised ? 560 : 400;
  const mapWrapperClass = isMaximised ? 'min-h-[70vh] h-[80dvh] w-full' : 'min-h-[420px] w-full';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMaximised
            ? 'max-h-[95dvh] w-[min(100vw-1.5rem,1400px)] max-w-[min(100vw-1.5rem,1400px)] gap-3 p-4 sm:p-6'
            : 'max-w-3xl sm:max-w-4xl'
        )}
      >
        <DialogHeader>
          <DialogTitle>Propagation map{shortLabel ? ` — ${shortLabel}` : ''}</DialogTitle>
          <DialogDescription>Cached RF coverage preview when a render is available.</DialogDescription>
        </DialogHeader>
        <div className={cn(mapWrapperClass)} style={{ position: 'relative', zIndex: 1 }}>
          {showLoading && (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">Loading…</div>
          )}
          {showEmpty && (
            <div className="flex h-[400px] items-center justify-center rounded-md border bg-muted/30 text-muted-foreground text-sm">
              Map not rendered yet
            </div>
          )}
          {showMap && (
            <RfPropagationMap
              assetUrl={mapAsset}
              bounds={mapBounds}
              minHeight={mapMinHeight}
              className={isMaximised ? 'h-full min-h-[65vh]' : undefined}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
