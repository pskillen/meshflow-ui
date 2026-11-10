import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Returns a getter for the URL's query params *right now*.
 *
 * `useSearchParams()` (and the `prev` handed to a `setSearchParams` updater) are values from the last render. Two
 * writers acting between a navigation and the re-render that follows it (a range click, then a tab click) would
 * each start from the same stale params and the second would drop the first's change. In a browser, `history`
 * already holds the newest URL, so read that when it is for the page being rendered; otherwise (memory routers in
 * tests, a basename) fall back to the last rendered params.
 */
export function useLatestSearchParams(): () => URLSearchParams {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const rendered = useRef({ pathname, searchParams });

  useEffect(() => {
    rendered.current = { pathname, searchParams };
  }, [pathname, searchParams]);

  return useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname === rendered.current.pathname) {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams(rendered.current.searchParams);
  }, []);
}
