import { createContext } from 'react';

/** Set by `ChartCard` when it shows a headline, so the chart inside can point `aria-describedby` at it. */
export const ChartCardContext = createContext<{ headlineId?: string }>({});
