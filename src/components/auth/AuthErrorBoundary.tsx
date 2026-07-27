import { Component, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { authService } from '@/lib/auth/authService';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/types';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

function isUnauthorizedError(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

interface AuthErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface AuthErrorBoundaryState {
  error: unknown;
}

export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  state: AuthErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): AuthErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (isUnauthorizedError(error)) {
      authService.handleSessionExpired({
        message: 'Your session has expired. Please log in again.',
        reason: 'session_expired',
      });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;

    if (error) {
      if (isUnauthorizedError(error)) {
        return (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
            <h2 className="text-xl font-semibold">Your session has expired</h2>
            <p className="text-muted-foreground">Please sign in again to continue.</p>
            <Button asChild>
              <Link to="/login" state={{ reason: 'session_expired' }}>
                Sign in
              </Link>
            </Button>
          </div>
        );
      }

      const message = isApiError(error) ? error.message : 'Something went wrong';
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold">Unable to load this page</h2>
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={this.handleRetry}>Try again</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AuthErrorBoundaryWithReset({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => <AuthErrorBoundary onReset={reset}>{children}</AuthErrorBoundary>}
    </QueryErrorResetBoundary>
  );
}
