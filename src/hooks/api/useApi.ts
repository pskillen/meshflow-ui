import { useMemo } from 'react';
import { MeshflowApi } from '@/lib/api/meshflow-api';
import { useConfig } from '@/providers/ConfigProvider';
import type { AppConfig, ApiConfig } from '@/lib/types';

function resolveMeshflowApiConfig(config: AppConfig): ApiConfig {
  return config.apis.meshflow ?? config.apis.meshBot;
}

/**
 * Hook to get an instance of the Meshflow API client.
 */
export function useMeshflowApi() {
  const config = useConfig();
  const api = useMemo(() => {
    return new MeshflowApi(resolveMeshflowApiConfig(config));
  }, [config]);

  return api;
}

/** @deprecated Use {@link useMeshflowApi} */
export const useMeshtasticApi = useMeshflowApi;
