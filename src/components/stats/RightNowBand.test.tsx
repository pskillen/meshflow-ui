import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RightNowBand, RightNowCounts } from './RightNowBand';
import { StatTile } from './StatTile';

const MT = { '2': 5, '24': 12, '168': 20, '720': 40, '2160': 100, all: 999 };
const MC = { '2': 2, '24': 3, '168': 4, '720': 6, '2160': 8, all: 888 };

vi.mock('@/hooks/api/useNodes', () => ({
  useRecentNodeCountsSuspense: (p: string) => (p === 'meshcore' ? MC : MT),
  useRecentNodeCountsBothSuspense: () => ({ meshtastic: MT, meshcore: MC }),
}));

const tile = (k: string) => screen.getByTestId(`right-now-tile-${k}`);
const rowCells = (name: string) => {
  const row = within(screen.getByTestId('right-now-table')).getByRole('rowheader', { name }).closest('tr')!;
  return [...row.children].map((c) => c.textContent);
};

describe('RightNowBand', () => {
  it('both: tiles show the total with per-protocol counts, table has one row each', () => {
    render(<RightNowBand scope="both" />);
    expect(screen.getByRole('heading', { name: 'Right now' })).toBeTruthy();
    expect(tile('2').textContent).toContain('Online now');
    expect(tile('2').textContent).toContain('7');
    expect(tile('2').textContent).toContain('MT 5 · MC 2');
    expect(tile('2160').textContent).toContain('108');
    expect(rowCells('Meshtastic')).toEqual(['Meshtastic', '5', '12', '20', '40', '100']);
    expect(rowCells('MeshCore')).toEqual(['MeshCore', '2', '3', '4', '6', '8']);
  });

  it('meshtastic: own numbers only, one phone row', () => {
    render(<RightNowBand scope="meshtastic" />);
    expect(tile('24').textContent).toContain('12');
    expect(tile('24').textContent).not.toContain('MT');
    expect(rowCells('Nodes')).toEqual(['Nodes', '5', '12', '20', '40', '100']);
  });

  it('meshcore: own numbers only', () => {
    render(<RightNowBand scope="meshcore" />);
    expect(tile('168').textContent).toContain('4');
    expect(rowCells('Nodes')).toEqual(['Nodes', '2', '3', '4', '6', '8']);
  });

  it('shows five windows and no all-time column', () => {
    render(<RightNowBand scope="meshtastic" />);
    expect(screen.getAllByTestId(/^right-now-tile-/)).toHaveLength(5);
    expect(screen.queryByText(/all time/i)).toBeNull();
    expect(screen.queryByText('999')).toBeNull();
  });

  it('a missing window shows an em dash, not 0', () => {
    render(<RightNowCounts scope="meshcore" meshcore={{ '24': 3 }} />);
    expect(tile('2').textContent).toContain('—');
    expect(tile('24').textContent).toContain('3');
    expect(rowCells('Nodes')).toEqual(['Nodes', '—', '3', '—', '—', '—']);
  });

  it('both: sums only the present parts, and shows a dash when neither is present', () => {
    render(<RightNowCounts scope="both" meshtastic={{ '2': 5 }} meshcore={{ '24': 3 }} />);
    expect(tile('2').textContent).toContain('5');
    expect(tile('2').textContent).toContain('MT 5 · MC —');
    expect(tile('24').textContent).toContain('MT — · MC 3');
    expect(within(tile('168')).getByText('—', { selector: 'div' })).toBeTruthy();
  });

  it('is accessible: captioned table with scoped headers, labelled section, tiles as a list', () => {
    render(<RightNowBand scope="both" />);
    const table = within(screen.getByTestId('right-now-table')).getByRole('table', {
      name: 'Nodes heard in each recent window',
    });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    expect(within(table).getByRole('columnheader', { name: 'Online now, heard in last 2h' })).toBeTruthy();
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Meshtastic', 'MeshCore']);
    expect(screen.getByRole('region', { name: 'Right now' })).toBeTruthy();
    expect(within(screen.getByTestId('right-now-tiles')).getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('StatTile', () => {
  it('renders any label, value and sub', () => {
    render(<StatTile label="Battery" value="87%" sub="median" hero />);
    expect(screen.getByText('Battery')).toBeTruthy();
    expect(screen.getByText('87%')).toBeTruthy();
    expect(screen.getByText('median')).toBeTruthy();
  });
});
