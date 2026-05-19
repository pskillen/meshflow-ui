import { AppConfig } from '@/lib/types';
import axios from 'axios';

// This var will be set to the version of the app when it is built
const VERSION = 'development';

// Default configuration
const defaultConfig: AppConfig = {
  version: VERSION,
  mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN as string | undefined,
  apis: {
    meshBot: {
      baseUrl: 'http://localhost:8000',
      basePath: '/api', // Updated to use the new API base path
      timeout: 10000,
      auth: {
        type: 'token',
        token: 'd9891a1ed5541ae02392b9829cb68267bf68e06c', // This token should be replaced with a valid JWT token
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

// Function to fetch and merge config
async function fetchConfig(): Promise<AppConfig> {
  try {
    const response = await axios.get('/config.json');
    const remoteConfig = response.data;

    // Deep merge the configs, with remote config taking precedence
    const meshBot = {
      ...defaultConfig.apis.meshBot,
      ...remoteConfig.apis?.meshBot,
    };
    const meshflow = remoteConfig.apis?.meshflow ? { ...meshBot, ...remoteConfig.apis.meshflow } : meshBot;

    return {
      version: VERSION,
      mapboxToken: remoteConfig.mapboxToken ?? defaultConfig.mapboxToken,
      apis: {
        meshBot,
        meshflow,
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

// Create a promise that resolves to the final config
const configPromise = fetchConfig();

// Export a function to get the config
export async function getConfig(): Promise<AppConfig> {
  return configPromise;
}

// For backward compatibility, export the promise
export default configPromise;
