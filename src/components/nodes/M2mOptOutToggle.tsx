import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMeshflowApi } from '@/hooks/api/useApi';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function M2mOptOutToggle({
  internalId,
  optedOut,
  editable,
}: {
  internalId: string;
  optedOut: boolean;
  editable?: boolean;
}) {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(optedOut);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (next: boolean) => api.patchM2mOptOut(internalId, next),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['observed-node-lookup'] });
    },
    onError: (_err, next) => {
      setChecked(!next);
      setError('Could not update the public data API setting.');
    },
  });

  if (!editable) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Switch
          checked={checked}
          disabled={mutation.isPending}
          onCheckedChange={(next) => {
            setChecked(next);
            mutation.mutate(next);
          }}
          aria-label="Exclude from public data API"
        />
        <Label>Exclude from public data API</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Excluded nodes are left out of per-node listings in the public M2M data API but are still counted in anonymous
        totals.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
