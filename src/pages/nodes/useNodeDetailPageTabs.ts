import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLatestSearchParams } from '@/hooks/useLatestSearchParams';
import { isValidNodeDetailTab, parseNodeDetailTab, type NodeDetailTab } from '@/lib/node-detail-tab';

export function useNodeDetailPageTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = parseNodeDetailTab(rawTab);
  const getLatestParams = useLatestSearchParams();

  useEffect(() => {
    if (rawTab != null && !isValidNodeDetailTab(rawTab)) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
  }, [rawTab, searchParams, setSearchParams]);

  const onTabChange = useCallback(
    (tab: NodeDetailTab) => {
      // The latest URL, not this render's: a range click just before this must not be overwritten.
      const next = getLatestParams();
      if (tab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      setSearchParams(next, { replace: true });
    },
    [getLatestParams, setSearchParams]
  );

  return { activeTab, onTabChange };
}
