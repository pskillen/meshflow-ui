import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useMeshtasticApi } from './useApi';
import { dxNotificationSettingsQueryKey } from '@/hooks/api/dxNotificationSettingsQueryKey';
import type { DxEventsQueryParams } from '@/lib/types';
import type { DxNotificationSettingsWrite } from '@/lib/models';

export const dxEventsQueryKey = (params: DxEventsQueryParams) => ['dx', 'events', params] as const;

export const dxEventDetailQueryKey = (id: string | null) => ['dx', 'event', id ?? ''] as const;

export { dxNotificationSettingsQueryKey } from '@/hooks/api/dxNotificationSettingsQueryKey';

const DX_POLL_MS = 60_000;
const DX_STALE_MS = 30_000;

export function useDxEvents(params: DxEventsQueryParams, enabled: boolean) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: dxEventsQueryKey(params),
    queryFn: () => api.getDxEvents(params),
    enabled,
    refetchInterval: DX_POLL_MS,
    staleTime: DX_STALE_MS,
  });
}

export function useDxEventDetail(id: string | null, enabled: boolean) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: dxEventDetailQueryKey(id),
    queryFn: () => api.getDxEvent(id!),
    enabled: Boolean(enabled && id),
    refetchInterval: DX_POLL_MS,
    staleTime: DX_STALE_MS,
  });
}

export function useDxActiveEventCount(enabled: boolean) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: ['dx', 'stats', 'active_now'] as const,
    queryFn: () => api.getDxEvents({ active_now: true, page_size: 1, page: 1 }),
    enabled,
    select: (d) => d.count,
    refetchInterval: DX_POLL_MS,
    staleTime: DX_STALE_MS,
  });
}

export function useDxRecentEventCount(enabled: boolean, recentDays = 7) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: ['dx', 'stats', 'recent', recentDays] as const,
    queryFn: () =>
      api.getDxEvents({
        recent_only: true,
        recent_days: recentDays,
        page_size: 1,
        page: 1,
      }),
    enabled,
    select: (d) => d.count,
    refetchInterval: DX_POLL_MS,
    staleTime: DX_STALE_MS,
  });
}

export function useDxNodeExclusionMutation() {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { meshtastic_node_id: number; exclude_from_detection: boolean; exclude_notes?: string }) =>
      api.postDxNodeExclusion(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dx'] });
    },
  });
}

const DX_SETTINGS_STALE_MS = 60_000;

export function useDxNotificationSettings(enabled = true) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: dxNotificationSettingsQueryKey,
    queryFn: () => api.getDxNotificationSettings(),
    enabled,
    staleTime: DX_SETTINGS_STALE_MS,
  });
}

export function usePatchDxNotificationSettings() {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DxNotificationSettingsWrite) => api.patchDxNotificationSettings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dxNotificationSettingsQueryKey });
    },
  });
}

/** User-visible message for failed PATCH (Discord gate, validation, network). */
export function getDxNotificationSettingsSaveErrorMessage(err: unknown): string {
  if (err instanceof AxiosError && err.response?.data && typeof err.response.data === 'object') {
    const d = err.response.data as {
      code?: string;
      detail?: string;
      categories?: unknown;
    };
    if (d.code === 'NEEDS_DISCORD_VERIFICATION' && typeof d.detail === 'string') {
      return d.detail;
    }
    if (typeof d.detail === 'string' && d.detail.trim()) {
      return d.detail;
    }
    if (Array.isArray(d.categories) && d.categories.length && typeof d.categories[0] === 'string') {
      return d.categories[0];
    }
    if (d.categories && typeof d.categories === 'object' && !Array.isArray(d.categories)) {
      const first = Object.values(d.categories as Record<string, string[]>).flat()[0];
      if (typeof first === 'string') return first;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Could not save DX notification settings';
}
