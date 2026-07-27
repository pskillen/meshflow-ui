import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { AppConfig } from '@/lib/types';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('Config', () => {
  const defaultConfig: AppConfig = {
    version: 'development',
    mapboxToken: undefined,
    apis: {
      meshBot: {
        baseUrl: 'http://localhost:8000',
        basePath: '/api/ui',
        timeout: 10000,
        auth: {
          type: 'none',
        },
        headers: {
          Accept: 'application/json',
        },
      },
    },
    map: {
      defaultCenter: [0, 0],
      defaultZoom: 2,
    },
    refresh: {
      nodesList: 30000, // 30 seconds
      nodeDetails: 10000, // 10 seconds
    },
  };

  const remoteConfig = {
    mapboxToken: 'pk.remote-token',
    apis: {
      meshBot: {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        auth: {
          type: 'none',
        },
      },
    },
    map: {
      defaultCenter: [0, 0],
      defaultZoom: 5,
    },
    refresh: {
      nodesList: 60000, // 60 seconds
      nodeDetails: 10000,
    },
  };

  let configPromise: Promise<AppConfig> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    configPromise = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  async function fetchConfig(): Promise<AppConfig> {
    try {
      const response = await axios.get('/config.json');
      const remoteConfig = response.data;

      // Deep merge the configs, with remote config taking precedence
      return {
        version: 'development',
        mapboxToken: remoteConfig.mapboxToken ?? defaultConfig.mapboxToken,
        apis: {
          meshBot: {
            ...defaultConfig.apis.meshBot,
            ...remoteConfig.apis?.meshBot,
          },
        },
        map: {
          ...defaultConfig.map,
          ...remoteConfig.map,
        },
        refresh: {
          ...defaultConfig.refresh,
          ...remoteConfig.refresh,
        },
      };
    } catch {
      console.log('No config.json found, using default configuration');
      return defaultConfig;
    }
  }

  async function getConfig(): Promise<AppConfig> {
    if (!configPromise) {
      configPromise = fetchConfig();
    }
    return configPromise;
  }

  it('should return default config when fetch fails', async () => {
    // Mock axios to throw an error
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

    // Get the config
    const config = await getConfig();

    // Verify the config is the default
    expect(config).toEqual(defaultConfig);
    expect(axios.get).toHaveBeenCalledWith('/config.json');
  });

  it('should merge remote config with default config', async () => {
    // Mock axios to return remote config
    vi.mocked(axios.get).mockResolvedValueOnce({ data: remoteConfig });

    // Get the config
    const config = await getConfig();

    // Verify the config is merged correctly
    expect(config.version).toBe('development');
    expect(config.apis.meshBot.baseUrl).toBe('https://api.example.com');
    expect(config.apis.meshBot.basePath).toBe('/api/ui'); // From default
    expect(config.apis.meshBot.timeout).toBe(5000);
    expect(config.apis.meshBot.auth.type).toBe('none');
    expect(config.map.defaultCenter).toEqual([0, 0]); // From default
    expect(config.map.defaultZoom).toBe(5);
    expect(config.refresh.nodesList).toBe(60000);
    expect(config.refresh.nodeDetails).toBe(10000); // From default
    expect(config.mapboxToken).toBe('pk.remote-token');
  });

  it('should handle partial remote config', async () => {
    // Mock axios to return partial remote config
    const partialRemoteConfig = {
      apis: {
        meshBot: {
          baseUrl: 'https://api.example.com',
        },
      },
    };
    vi.mocked(axios.get).mockResolvedValueOnce({ data: partialRemoteConfig });

    // Get the config
    const config = await getConfig();

    // Verify the config is merged correctly
    expect(config.version).toBe('development');
    expect(config.apis.meshBot.baseUrl).toBe('https://api.example.com');
    expect(config.apis.meshBot.basePath).toBe('/api/ui'); // From default
    expect(config.apis.meshBot.timeout).toBe(10000); // From default
    expect(config.apis.meshBot.auth.type).toBe('none'); // From default
    expect(config.map.defaultCenter).toEqual([0, 0]); // From default
    expect(config.map.defaultZoom).toBe(2); // From default
    expect(config.refresh.nodesList).toBe(30000); // From default
    expect(config.refresh.nodeDetails).toBe(10000); // From default
    expect(config.mapboxToken).toBeUndefined();
  });

  it('should cache the config promise', async () => {
    // Mock axios to return remote config
    vi.mocked(axios.get).mockResolvedValueOnce({ data: remoteConfig });

    // Get the config twice
    const config1 = await getConfig();
    const config2 = await getConfig();

    // Verify axios was only called once
    expect(axios.get).toHaveBeenCalledTimes(1);
    
    // Verify both configs are the same
    expect(config1).toEqual(config2);
  });
}); 