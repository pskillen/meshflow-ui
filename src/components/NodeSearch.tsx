import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNodes } from '@/hooks/api/useNodes';
import { SearchIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface NodeSearchProps {
  onNodeSelect?: (
    nodeId: number,
    node?: { short_name?: string | null; long_name?: string | null; node_id_str?: string }
  ) => void;
  /** When set, shows the selected node name instead of search (e.g. after selection from map) */
  displayValue?: string | null;
  /** Called when user clears the selection */
  onClearSelection?: () => void;
  /**
   * When set, search hits must have `last_heard` on or after this instant (nodes without last_heard are hidden).
   */
  lastHeardAfter?: Date;
}

function searchResultHeardOnOrAfter(node: { last_heard?: string | null }, cutoff: Date): boolean {
  if (node.last_heard == null || node.last_heard === '') return false;
  const t = new Date(node.last_heard);
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() >= cutoff.getTime();
}

export function NodeSearch({ onNodeSelect, displayValue, onClearSelection, lastHeardAfter }: NodeSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { searchNodes, searchResults, isSearching } = useNodes();

  const filteredSearchResults = useMemo(() => {
    const raw = searchResults ?? [];
    if (lastHeardAfter == null) return raw;
    return raw.filter((n) => searchResultHeardOnOrAfter(n, lastHeardAfter));
  }, [searchResults, lastHeardAfter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchNodes(query);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchNodes]);

  if (displayValue != null && displayValue !== '') {
    return (
      <div className="flex items-center gap-2">
        <Input type="text" readOnly className="h-9 flex-1 bg-muted" value={displayValue} />
        {onClearSelection && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onClearSelection}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search nodes..."
          className="h-9 w-full"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {isOpen && (query.length >= 2 || searchResults) && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 bg-popover rounded-lg shadow-lg border border-border">
          {isSearching ? (
            <div className="p-2 text-center">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : filteredSearchResults.length === 0 ? (
            <div className="p-2 text-muted-foreground">
              {(searchResults?.length ?? 0) > 0 && lastHeardAfter != null
                ? 'No matching nodes heard recently.'
                : 'No nodes found'}
            </div>
          ) : (
            <ul className="py-1">
              {filteredSearchResults.map((node) => (
                <li key={node.internal_id}>
                  <Link
                    to={onNodeSelect ? '#' : `/nodes/${node.meshtastic_node_id}`}
                    className="block px-4 py-2 hover:bg-accent"
                    onClick={() => {
                      setIsOpen(false);
                      setQuery('');
                      if (onNodeSelect) {
                        onNodeSelect(node.meshtastic_node_id, node);
                      }
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{node.short_name}</span>
                      <span className="text-sm text-muted-foreground">{node.long_name}</span>
                      <span className="text-sm text-muted-foreground">{node.node_id_str}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
