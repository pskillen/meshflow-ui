import { ApiConfig } from '@/lib/types';
import { eventService } from '@/lib/events/eventService';

export interface SessionExpiredParams {
  reason?: string;
  message?: string;
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'meshflow_access_token';
const REFRESH_TOKEN_KEY = 'meshflow_refresh_token';
const AUTH_PROVIDER_KEY = 'meshflow_auth_provider';
const USER_DETAILS_KEY = 'meshflow_user_details';

// Token interface
export interface AuthTokens {
  access: string;
  refresh: string;
}

// User interface
export interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  /** From `/api/auth/user/`; staff may access DX monitoring APIs. */
  is_staff?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // For any additional fields
}

// Auth provider type
export type AuthProvider = 'password' | 'google' | 'github' | 'discord' | null;

// Define auth event types
export enum AuthEventType {
  AUTH_ERROR = 'auth_error',
  AUTH_TOKEN_REFRESHED = 'auth_token_refreshed',
  AUTH_LOGOUT = 'auth_logout',
}

// Callback for session expired (registered by AuthProvider); allows direct invocation without events
let _sessionExpiredCallback: ((params: SessionExpiredParams) => void) | null = null;

// Authentication service - single source of truth for tokens and user
export const authService = {
  /** Register callback for session expired. Returns unsubscribe. */
  onSessionExpired(callback: (params: SessionExpiredParams) => void): () => void {
    _sessionExpiredCallback = callback;
    return () => {
      _sessionExpiredCallback = null;
    };
  },

  /** Called by axios interceptor on 401/refresh failure. Clears tokens and invokes callback. */
  handleSessionExpired(params: SessionExpiredParams = {}): void {
    this.clearTokens();
    _sessionExpiredCallback?.(params);
  },

  // Store tokens in local storage
  setTokens(tokens: AuthTokens, provider: AuthProvider = 'password'): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    if (tokens.refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    localStorage.setItem(AUTH_PROVIDER_KEY, provider || '');
  },

  // Store only access token (e.g. OAuth callback with token-only); does not clear refresh
  setAccessTokenOnly(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  // Get access token from local storage
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  // Get refresh token from local storage
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  // Decode JWT payload and return exp (expiry) timestamp in seconds, or null
  getTokenExpiry(accessToken: string): number | null {
    try {
      const payload = accessToken.split('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      const exp = decoded.exp;
      return typeof exp === 'number' ? exp : null;
    } catch {
      return null;
    }
  },

  // Get auth provider from local storage
  getAuthProvider(): AuthProvider {
    const provider = localStorage.getItem(AUTH_PROVIDER_KEY);
    return (provider as AuthProvider) || null;
  },

  // Clear tokens from local storage
  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_PROVIDER_KEY);
    localStorage.removeItem(USER_DETAILS_KEY);
  },

  // Store user details in local storage
  setUserDetails(user: User): void {
    localStorage.setItem(USER_DETAILS_KEY, JSON.stringify(user));
  },

  // Get user details from local storage
  getUserDetails(): User | null {
    const userJson = localStorage.getItem(USER_DETAILS_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  },

  // Update user details
  async updateUserDetails(baseUrl: string, userData: { email?: string; display_name?: string }): Promise<User> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${baseUrl}/api/auth/user/`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Failed to update user details');
    }

    const user = await response.json();
    this.setUserDetails(user);
    return user;
  },

  // Change password
  async changePassword(baseUrl: string, passwords: { new_password1: string; new_password2: string }): Promise<void> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${baseUrl}/api/auth/password/change/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwords),
    });

    if (!response.ok) {
      throw new Error('Failed to change password');
    }
  },

  // Fetch user details from the server
  async fetchUserDetails(baseUrl: string): Promise<User> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    let response = await fetch(`${baseUrl}/api/auth/user/`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      try {
        const newAccessToken = await this.refreshToken(baseUrl);
        response = await fetch(`${baseUrl}/api/auth/user/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${newAccessToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        this.clearTokens();
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      throw new Error('Failed to fetch user details');
    }

    const user = await response.json();
    this.setUserDetails(user);
    return user;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  // Login with username and password
  async login(baseUrl: string, username: string, password: string): Promise<AuthTokens> {
    const response = await fetch(`${baseUrl}/api/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens);

    // Fetch user details after successful login
    try {
      await this.fetchUserDetails(baseUrl);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }

    return tokens;
  },

  // Refresh access token using refresh token
  async refreshToken(baseUrl: string): Promise<string> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${baseUrl}/api/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      this.clearTokens(); // Clear tokens if refresh fails
      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    // Update access token; persist rotated refresh token if backend returns one
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    if (data.refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
    }

    return data.access;
  },

  // Logout user (user-initiated; does not trigger session-expired redirect)
  logout(): void {
    this.clearTokens();
    eventService.emit(AuthEventType.AUTH_LOGOUT);
  },

  // Initialize user details if authenticated
  async initializeUser(baseUrl: string): Promise<User | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      return await this.fetchUserDetails(baseUrl);
    } catch (error) {
      console.error('Failed to initialize user details:', error);
      return null;
    }
  },

  // Login with Google
  async loginWithGoogle(baseUrl: string, googleToken: string): Promise<AuthTokens> {
    const response = await fetch(`${baseUrl}/api/auth/social/google/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: googleToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Google login failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens, 'google');

    // Fetch user details after successful login
    try {
      await this.fetchUserDetails(baseUrl);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }

    return tokens;
  },

  // Login with GitHub
  async loginWithGitHub(baseUrl: string, githubToken: string): Promise<AuthTokens> {
    const response = await fetch(`${baseUrl}/api/auth/social/github/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: githubToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'GitHub login failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens, 'github');

    // Fetch user details after successful login
    try {
      await this.fetchUserDetails(baseUrl);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }

    return tokens;
  },

  // Login with Discord
  async loginWithDiscord(baseUrl: string, discordToken: string): Promise<AuthTokens> {
    const response = await fetch(`${baseUrl}/api/auth/social/discord/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: discordToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Discord login failed');
    }

    const tokens = await response.json();
    this.setTokens(tokens, 'discord');

    // Fetch user details after successful login
    try {
      await this.fetchUserDetails(baseUrl);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    }

    return tokens;
  },

  // Get Google auth URL and redirect
  async getGoogleAuthUrl(baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/social/google/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Google authorization URL');
    }

    const data = await response.json();
    return data.authorization_url;
  },

  // Get GitHub auth URL and redirect
  async getGitHubAuthUrl(baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/social/github/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get GitHub authorization URL');
    }

    const data = await response.json();
    return data.authorization_url;
  },

  // Get Discord auth URL and redirect
  async getDiscordAuthUrl(baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/social/discord/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Discord authorization URL');
    }

    const data = await response.json();
    return data.authorization_url;
  },

  /**
   * Authenticated: Discord OAuth URL to link Discord to the current Meshflow account
   * (separate redirect URI from login). Requires Bearer JWT.
   */
  async getDiscordConnectAuthUrl(baseUrl: string): Promise<string> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('You must be signed in to link Discord');
    }
    const response = await fetch(`${baseUrl}/api/auth/social/discord/connect/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Failed to get Discord connect authorization URL');
    }

    const data = await response.json();
    return data.authorization_url as string;
  },

  // Update API config with current token
  updateApiConfig(config: ApiConfig): ApiConfig {
    const accessToken = this.getAccessToken();

    if (accessToken) {
      return {
        ...config,
        auth: {
          ...config.auth,
          type: 'token',
          token: accessToken,
        },
      };
    }

    return config;
  },

  // Get current user from stored user details or decode JWT as fallback
  getCurrentUser(): User | null {
    // First try to get user from stored details
    const storedUser = this.getUserDetails();
    if (storedUser) {
      return storedUser;
    }

    // Fallback to decoding JWT if no stored user details
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      // JWT format: header.payload.signature
      const payload = token.split('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      // Typical JWT user fields: user_id or id, and username
      const id = decoded.user_id || decoded.id;
      const username = decoded.username;
      if (typeof id === 'number' && typeof username === 'string') {
        return { id, username };
      }
      return null;
    } catch {
      return null;
    }
  },
};
