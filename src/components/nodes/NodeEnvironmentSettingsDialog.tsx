import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMeshflowApi } from '@/hooks/api/useApi';
import type { EnvironmentExposureSlug, WeatherUseSlug } from '@/lib/models';

const EXPOSURE_OPTIONS: EnvironmentExposureSlug[] = ['unknown', 'indoor', 'outdoor', 'sheltered'];
const WEATHER_USE_OPTIONS: WeatherUseSlug[] = ['unknown', 'include', 'exclude'];

function labelExposure(v: EnvironmentExposureSlug): string {
  switch (v) {
    case 'unknown':
      return 'Unknown';
    case 'indoor':
      return 'Indoor';
    case 'outdoor':
      return 'Outdoor';
    case 'sheltered':
      return 'Sheltered (e.g. porch)';
    default:
      return v;
  }
}

function labelWeatherUse(v: WeatherUseSlug): string {
  switch (v) {
    case 'unknown':
      return 'Unknown';
    case 'include':
      return 'Include in weather views';
    case 'exclude':
      return 'Exclude from weather views';
    default:
      return v;
  }
}

export interface NodeEnvironmentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  internalId: string;
  initialEnvironmentExposure: EnvironmentExposureSlug;
  initialWeatherUse: WeatherUseSlug;
}

export function NodeEnvironmentSettingsDialog({
  open,
  onOpenChange,
  internalId,
  initialEnvironmentExposure,
  initialWeatherUse,
}: NodeEnvironmentSettingsDialogProps) {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  const [environmentExposure, setEnvironmentExposure] = useState<EnvironmentExposureSlug>(initialEnvironmentExposure);
  const [weatherUse, setWeatherUse] = useState<WeatherUseSlug>(initialWeatherUse);

  useEffect(() => {
    if (open) {
      setEnvironmentExposure(initialEnvironmentExposure);
      setWeatherUse(initialWeatherUse);
    }
  }, [open, initialEnvironmentExposure, initialWeatherUse]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patchObservedNodeEnvironmentSettings(internalId, {
        environment_exposure: environmentExposure,
        weather_use: weatherUse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nodes', internalId] });
      void queryClient.invalidateQueries({ queryKey: ['nodes', 'weather'] });
      toast.success('Node settings saved');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Could not save settings. Check permissions or try again.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Node settings</DialogTitle>
          <DialogDescription>
            Environment placement and whether this node appears in weather-style views. Further options can be added
            here later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="node-env-exposure">Sensor placement</Label>
            <Select
              value={environmentExposure}
              onValueChange={(v) => setEnvironmentExposure(v as EnvironmentExposureSlug)}
            >
              <SelectTrigger id="node-env-exposure">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPOSURE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {labelExposure(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="node-weather-use">Weather views</Label>
            <Select value={weatherUse} onValueChange={(v) => setWeatherUse(v as WeatherUseSlug)}>
              <SelectTrigger id="node-weather-use">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEATHER_USE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {labelWeatherUse(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="border-dashed bg-muted/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">More settings</CardTitle>
              <CardDescription className="text-xs">Reserved for future node options.</CardDescription>
            </CardHeader>
          </Card>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
