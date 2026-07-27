import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authService, AuthProvider as AuthProviderType } from '@/lib/auth/authService';
import { useConfig } from './ConfigProvider';
import { eventService } from '@/lib/events/eventService';
import { AuthEventType } from '@/lib/auth/authService';
import { discordNotificationPrefsQueryKey } from '@/hooks/api/useDiscordNotifications';

// Auth context interface
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  loginWithDiscord: () => Promise<void>;
  // handleGoogleCallback: (code: string) => Promise<void>;
  // handleGitHubCallback: (code: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  authProvider: AuthProviderType;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider props
interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderType>(null);
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Proactive token refresh: check every 90s, refresh if expired within 5 min
  useEffect(() => {
    if (!config?.apis?.meshBot?.baseUrl) return;

    const REFRESH_INTERVAL_MS = 90 * 1000; // 90 seconds
    const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

    const maybeRefresh = async () => {
      const accessToken = authService.getAccessToken();
      const refreshToken = authService.getRefreshToken();
      if (!accessToken || !refreshToken) return;

      const exp = authService.getTokenExpiry(accessToken);
      if (!exp) return;

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresInSec = exp - nowSec;
      const expiresInMs = expiresInSec * 1000;

      if (expiresInMs <= REFRESH_BEFORE_EXPIRY_MS) {
        try {
          await authService.refreshToken(config.apis.meshBot.baseUrl);
          eventService.emit(AuthEventType.AUTH_TOKEN_REFRESHED);
        } catch {
          // Refresh failed; auth interceptor will handle 401 on next request
        }
      }
    };

    // Run once on mount
    maybeRefresh();

    const interval = setInterval(maybeRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [config?.apis?.meshBot?.baseUrl]);

  // Sync auth state from authService on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = authService.isAuthenticated();
        setIsAuthenticated(isAuth);
        setAuthProvider(isAuth ? authService.getAuthProvider() : null);

        if (isAuth) {
          const user = await authService.initializeUser(config.apis.meshBot.baseUrl);
          if (!user) {
            authService.clearTokens();
            setIsAuthenticated(false);
            setAuthProvider(null);
            navigate('/login', { state: { reason: 'session_expired' } });
            return;
          }
        }
      } catch (error) {
        console.error('Failed to initialize user details:', error);
        authService.clearTokens();
        setIsAuthenticated(false);
        setAuthProvider(null);
        navigate('/login', { state: { reason: 'session_expired' } });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [config.apis.meshBot.baseUrl, navigate]);

  // Register session-expired callback (called by axios interceptor via authService)
  useEffect(() => {
    const unsubscribe = authService.onSessionExpired((params) => {
      queryClient.clear();
      setIsAuthenticated(false);
      setAuthProvider(null);
      setError(params.message || 'Authentication failed. Please log in again.');
      navigate('/login', {
        state: { reason: params.reason || 'auth_failed' },
      });
    });
    return unsubscribe;
  }, [navigate, queryClient]);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      // Handle /auth/callback (code+state) and /oauth/callback (token)
      if ((location.pathname === '/auth/callback' || location.pathname === '/oauth/callback') && location.search) {
        const params = new URLSearchParams(location.search);
        const oauthError = params.get('error');
        if (oauthError?.startsWith('discord_connect_')) {
          const discordConnectMessages: Record<string, string> = {
            discord_connect_account_in_use: 'That Discord account is already linked to another Meshflow user.',
            discord_connect_invalid_state: 'This Discord link expired or was already used. Try connecting again.',
            discord_connect_missing_params: 'Discord did not return a complete authorization. Try again.',
            discord_connect_user_missing: 'Your Meshflow session could not be matched. Sign in again.',
            discord_connect_disabled: 'Your account cannot link Discord right now.',
            discord_connect_token_exchange: 'Could not complete Discord authorization. Try again.',
            discord_connect_no_access_token: 'Could not complete Discord authorization. Try again.',
            discord_connect_discord_profile: 'Could not read your Discord profile. Try again.',
          };
          setError(discordConnectMessages[oauthError] ?? `Discord linking failed (${oauthError}).`);
          navigate('/user', { replace: true });
          setIsLoading(false);
          return;
        }
        const token = params.get('token');
        if (token) {
          try {
            setIsLoading(true);
            authService.setAccessTokenOnly(token);
            setIsAuthenticated(authService.isAuthenticated());
            setAuthProvider(authService.getAuthProvider());
            await queryClient.invalidateQueries({ queryKey: discordNotificationPrefsQueryKey });
            navigate('/user');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'OAuth token handling failed');
          } finally {
            setIsLoading(false);
          }
          return;
        }
        // Existing code-based OAuth flow
        const code = params.get('code');
        const state = params.get('state');
        const provider = state?.split(':')[0];
        if (code) {
          try {
            setIsLoading(true);
            switch (provider) {
              case 'github':
                await handleGitHubCallback(code);
                break;
              case 'google':
                await handleGoogleCallback(code);
                break;
              case 'discord':
                await handleDiscordCallback(code);
                break;
              default:
                throw new Error(`Unsupported provider: ${provider}`);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : `${provider} authentication failed`);
          } finally {
            setIsLoading(false);
          }
        }
      }
    };
    handleCallback();
  }, [location]);

  // Login function
  const login = async (username: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.login(config.apis.meshBot.baseUrl, username, password);
      setIsAuthenticated(authService.isAuthenticated());
      setAuthProvider(authService.getAuthProvider());
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Get the Google auth URL and redirect to it
      const googleAuthUrl = await authService.getGoogleAuthUrl(config.apis.meshBot.baseUrl);
      window.location.href = googleAuthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get Google authorization URL');
      setIsLoading(false);
    }
  };

  // Login with GitHub
  const loginWithGitHub = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const githubAuthUrl = await authService.getGitHubAuthUrl(config.apis.meshBot.baseUrl);
      window.location.href = githubAuthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get GitHub authorization URL');
      setIsLoading(false);
    }
  };

  // Login with Discord
  const loginWithDiscord = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const discordAuthUrl = await authService.getDiscordAuthUrl(config.apis.meshBot.baseUrl);
      window.location.href = discordAuthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get Discord authorization URL');
      setIsLoading(false);
    }
  };

  // Handle Google callback
  const handleGoogleCallback = async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.loginWithGoogle(config.apis.meshBot.baseUrl, code);
      setIsAuthenticated(authService.isAuthenticated());
      setAuthProvider(authService.getAuthProvider());
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle GitHub callback
  const handleGitHubCallback = async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.loginWithGitHub(config.apis.meshBot.baseUrl, code);
      setIsAuthenticated(authService.isAuthenticated());
      setAuthProvider(authService.getAuthProvider());
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub login failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Discord callback
  const handleDiscordCallback = async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.loginWithDiscord(config.apis.meshBot.baseUrl, code);
      setIsAuthenticated(authService.isAuthenticated());
      setAuthProvider(authService.getAuthProvider());
      await queryClient.invalidateQueries({ queryKey: discordNotificationPrefsQueryKey });
      navigate('/user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discord login failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    authService.logout();
    queryClient.clear();
    setIsAuthenticated(false);
    navigate('/login'); // Redirect to login page after logout
  };

  // Context value
  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    loginWithGoogle,
    loginWithGitHub,
    loginWithDiscord,
    // handleGoogleCallback,
    // handleGitHubCallback,
    logout,
    error,
    authProvider,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
