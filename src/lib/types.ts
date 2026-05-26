// API request types
export interface DateRangeParams {
  startDate?: Date;
  endDate?: Date;
}

export interface DateRangeIntervalParams extends DateRangeParams {
  interval?: number;
  intervalType?: 'hour' | 'day' | 'week' | 'month';
}

export interface StatsQueryParams extends DateRangeIntervalParams {
  nodeId?: number;
}

export interface StatsSnapshotsParams {
  statType?: 'online_nodes' | 'new_nodes' | 'packet_volume' | 'mc_online_nodes' | 'mc_new_nodes' | 'mc_packet_volume';
  constellationId?: number;
  recordedAtAfter?: Date;
  recordedAtBefore?: Date;
  page?: number;
  page_size?: number;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  last_heard_after?: Date;
}

/** Query params for GET `/api/dx/events/` (staff). */
export interface DxEventsQueryParams extends PaginationParams {
  state?: string;
  reason_code?: string;
  constellation?: number;
  destination_node_id?: number;
  last_observer_id?: string;
  active_now?: boolean;
  recent_only?: boolean;
  recent_days?: number;
  last_observed_after?: string;
  last_observed_before?: string;
  first_observed_after?: string;
  first_observed_before?: string;
}

export interface ApiAuthConfig {
  type: 'none' | 'token' | 'basic' | 'oauth' | 'apiKey';
  token?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  apiKeyHeader?: string; // Default is 'X-API-Key' for Meshflow API v2
}

export interface ApiConfig {
  baseUrl: string;
  basePath?: string;
  timeout: number;
  auth: ApiAuthConfig;
  headers?: Record<string, string>;
}

export interface AppConfig {
  version: string;
  mapboxToken?: string; // For Mapbox GL; injected at runtime in Docker
  apis: {
    /** Preferred key for the Meshflow REST API (falls back to meshBot when omitted). */
    meshflow?: ApiConfig;
    meshBot: ApiConfig;
  };
  map: {
    defaultCenter: [number, number];
    defaultZoom: number;
  };
  refresh: {
    nodesList: number; // milliseconds
    nodeDetails: number;
  };
}

export interface ApiError {
  message: string;
  status?: number;
  data?: unknown;
}

export class NotFoundError extends Error {
  status: number = 404;
  data?: unknown;
  constructor(message: string = 'Not Found', data?: unknown) {
    super(message);
    this.name = 'NotFoundError';
    this.data = data;
  }
}

export class ServerError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string = 'Server Error', status: number = 500, data?: unknown) {
    super(message);
    this.name = 'ServerError';
    this.status = status;
    this.data = data;
  }
}
