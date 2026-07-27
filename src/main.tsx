import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import App from './App';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import configPromise from '../config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status =
          (error as { status?: number })?.status ?? (error as { response?: { status?: number } })?.response?.status;

        // Do not retry on 401 - auth failures should not trigger retries
        if (status === 401) return false;

        // do not retry on client errors
        if (status && status >= 400 && status < 500) return false;

        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Wait for config to load before rendering
configPromise.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-colors duration-200">
            <App />
            <Toaster />
          </div>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
});
