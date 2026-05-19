import { useState } from 'react';
import { Maximize2, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ObservedNode } from '@/lib/models';
import { isRfPropagationNone } from '@/lib/models';
import {
  useRfProfile,
  useRfPropagation,
  useRecomputeRfPropagation,
  useDismissRfPropagation,
} from '@/hooks/api/useRfPropagation';
import { RfProfileModal } from '@/components/nodes/RfProfileModal';
import { RfPropagationMap } from '@/components/nodes/RfPropagationMap';
import { RfPropagationMapModal } from '@/components/nodes/RfPropagationMapModal';

export interface RfPropagationSectionProps {
  node: ObservedNode;
  /** Outer wrapper classes (default `mb-6`). Use `mb-0` when nested in a layout grid. */
  className?: string;
}

export function RfPropagationSection({ node, className = 'mb-6' }: RfPropagationSectionProps) {
  const internalId = node.internal_id;
  const canEdit = node.rf_profile_editable === true;
  const hasProfile = node.has_rf_profile === true;
  const showSection = canEdit || hasProfile;

  const [profileOpen, setProfileOpen] = useState(false);
  const [maximiseOpen, setMaximiseOpen] = useState(false);
  const { data: profile } = useRfProfile(internalId, { enabled: showSection });
  const { data: propagation, isLoading: propLoading } = useRfPropagation(internalId, { enabled: showSection });
  const recompute = useRecomputeRfPropagation(internalId);
  const dismiss = useDismissRfPropagation(internalId);

  if (!showSection) {
    return null;
  }

  const readyRow =
    propagation && !isRfPropagationNone(propagation) && propagation.status === 'ready' ? propagation : null;

  return (
    <div className={className}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>RF propagation</CardTitle>
            <CardDescription>
              Antenna and TX parameters for coverage modelling. Map appears when a render completes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readyRow?.asset_url && readyRow.bounds && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMaximiseOpen(true)}
                title="Open propagation map in a large view"
              >
                <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                Maximise
              </Button>
            )}
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setProfileOpen(true)}
                  title="Edit RF profile"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void recompute.mutateAsync()}
                  disabled={recompute.isPending}
                >
                  Render now
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Antenna height (m): </span>
                <span>{profile.antenna_height_m ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Gain (dBi): </span>
                <span>{profile.antenna_gain_dbi ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">TX power (dBm): </span>
                <span>{profile.tx_power_dbm ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Frequency (MHz): </span>
                <span>{profile.rf_frequency_mhz ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Pattern: </span>
                <span>{profile.antenna_pattern ?? '—'}</span>
              </div>
            </div>
          )}

          {!profile && canEdit && (
            <p className="text-sm text-muted-foreground">
              Configure the RF profile (location and antenna) to queue propagation renders.
            </p>
          )}

          {propLoading && (
            <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
            </div>
          )}

          {!propLoading && propagation && isRfPropagationNone(propagation) && (
            <p className="text-sm text-muted-foreground">No propagation render has been queued yet.</p>
          )}

          {!propLoading && propagation && !isRfPropagationNone(propagation) && propagation.status === 'pending' && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
              <p>Queued for rendering…</p>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void dismiss.mutateAsync()}
                  disabled={dismiss.isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}

          {!propLoading && propagation && !isRfPropagationNone(propagation) && propagation.status === 'running' && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
              <p>Rendering…</p>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void dismiss.mutateAsync()}
                  disabled={dismiss.isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}

          {!propLoading && propagation && !isRfPropagationNone(propagation) && propagation.status === 'failed' && (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Render failed</p>
              {propagation.error_message ? <p>{propagation.error_message}</p> : null}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => void recompute.mutateAsync()}>
                    Render now
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void dismiss.mutateAsync()}
                    disabled={dismiss.isPending}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          )}

          {!propLoading && readyRow?.asset_url && readyRow.bounds && (
            <RfPropagationMap assetUrl={readyRow.asset_url} bounds={readyRow.bounds} minHeight={300} />
          )}
        </CardContent>
      </Card>

      {canEdit && <RfProfileModal open={profileOpen} onOpenChange={setProfileOpen} node={node} />}

      {readyRow?.asset_url && readyRow.bounds && (
        <RfPropagationMapModal
          open={maximiseOpen}
          onOpenChange={setMaximiseOpen}
          assetUrl={readyRow.asset_url}
          bounds={readyRow.bounds}
          shortLabel={node.short_name ?? node.long_name}
          layout="maximised"
        />
      )}
    </div>
  );
}
