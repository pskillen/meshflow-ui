import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { BaseApi } from '@/lib/api/base';
import { authService } from '@/lib/auth/authService';
import { ApiConfig } from '@/lib/types';

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    refreshToken: vi.fn(),
    handleSessionExpired: vi.fn(),
    onSessionExpired: vi.fn(() => () => {}),
  },
  AuthEventType: {
    AUTH_TOKEN_REFRESHED: 'auth_token_refreshed',
  },
}));

vi.mock('@/lib/events/eventService', () => ({
  eventService: { emit: vi.fn() },
}));

class TestApi extends BaseApi {
  ping() {
    return this.get('/ping');
  }

  postPing() {
    return this.post('/ping', {});
  }

  getAxiosInstance() {
    return this.axios;
  }
}

const apiConfig: ApiConfig = {
  baseUrl: 'http://localhost:8000',
  basePath: '/api/ui',
  timeout: 10000,
  auth: { type: 'none' },
};

function installAdapter(
  instance: ReturnType<TestApi['getAxiosInstance']>,
  handler: (config: InternalAxiosRequestConfig) => Promise<unknown>
) {
  instance.defaults.adapter = async (config) => {
    try {
      const result = await handler(config);
      if (result instanceof Error) {
        throw result;
      }
      return {
        data: result ?? {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error;
      }
      throw error;
    }
  };
}

function axios401Error(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    data: { detail: 'Unauthorized' },
    headers: {},
    config,
  });
}

describe('BaseApi auth interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.getAccessToken).mockReturnValue(null);
    vi.mocked(authService.getRefreshToken).mockReturnValue(null);
  });

  it('does not attach Authorization header when no JWT is present', async () => {
    const api = new TestApi(apiConfig);
    let capturedAuth: string | undefined;

    installAdapter(api.getAxiosInstance(), async (config) => {
      capturedAuth = config.headers?.Authorization as string | undefined;
      return {};
    });

    await api.ping();

    expect(capturedAuth).toBeUndefined();
  });

  it('attaches JWT when access token is present', async () => {
    vi.mocked(authService.getAccessToken).mockReturnValue('jwt-token');

    const api = new TestApi(apiConfig);
    let capturedAuth: string | undefined;

    installAdapter(api.getAxiosInstance(), async (config) => {
      capturedAuth = config.headers?.Authorization as string | undefined;
      return {};
    });

    await api.ping();

    expect(capturedAuth).toBe('Bearer jwt-token');
  });

  it('does not expire session for guest GET requests without a token', async () => {
    const api = new TestApi(apiConfig);

    installAdapter(api.getAxiosInstance(), async (config) => {
      throw axios401Error(config);
    });

    await expect(api.ping()).rejects.toMatchObject({ status: 401 });
    expect(authService.handleSessionExpired).not.toHaveBeenCalled();
  });

  it('expires session on 401 when an access token is present but refresh is unavailable', async () => {
    vi.mocked(authService.getAccessToken).mockReturnValue('stale-jwt');

    const api = new TestApi(apiConfig);

    installAdapter(api.getAxiosInstance(), async (config) => {
      throw axios401Error(config);
    });

    await expect(api.postPing()).rejects.toMatchObject({ status: 401 });
    expect(authService.handleSessionExpired).toHaveBeenCalledWith({
      message: 'Your session has expired. Please log in again.',
      reason: 'session_expired',
    });
  });
});
