import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { InfrastructureExportRow } from '@/lib/infrastructure-export-rows';
import { InfrastructureExportTable } from './InfrastructureExportTable';

function makeRow(i: number, overrides: Partial<InfrastructureExportRow> = {}): InfrastructureExportRow {
  const id = String(i).padStart(4, '0');
  return {
    internal_id: String(i),
    node_id_str: `!${id}`,
    short_name: `N${id}`,
    long_name: `Node ${id}`,
    role_label: 'ROUTER',
    hw_model: 'TBEAM',
    last_heard_iso: `2026-01-${String(i).padStart(2, '0')}T00:00:00.000Z`,
    latitude: '',
    longitude: '',
    altitude: '',
    battery_percent: '',
    channel_util_percent: '',
    owner_username: '',
    is_managed_feeder: false,
    constellation_name: '',
    is_licensed: null,
    has_rf_profile: false,
    has_ready_rf_render: false,
    ...overrides,
  };
}

function renderTable(rows: InfrastructureExportRow[]) {
  return render(
    <MemoryRouter>
      <InfrastructureExportTable rows={rows} />
    </MemoryRouter>
  );
}

/** Node IDs in the order the body rows are rendered. */
function bodyNodeIds(): string[] {
  const rows = screen.getAllByRole('row').slice(2); // two header rows (titles + filters)
  return rows.map((r) => within(r).getAllByRole('cell')[0].textContent ?? '');
}

describe('InfrastructureExportTable', () => {
  it('sorts by last heard descending by default and toggles when a header is clicked', () => {
    renderTable([makeRow(1), makeRow(3), makeRow(2)]);
    expect(bodyNodeIds()).toEqual(['!0003', '!0002', '!0001']);

    // String columns cycle desc -> unsorted (input order) -> asc once desc is active.
    const header = () => screen.getByRole('button', { name: /Last heard/ });
    fireEvent.click(header());
    expect(bodyNodeIds()).toEqual(['!0001', '!0003', '!0002']);
    fireEvent.click(header());
    expect(bodyNodeIds()).toEqual(['!0001', '!0002', '!0003']);
  });

  it('applies the default role filter, hiding CLIENT_BASE nodes', () => {
    renderTable([makeRow(1), makeRow(2, { role_label: 'CLIENT_BASE' })]);
    expect(bodyNodeIds()).toEqual(['!0001']);
    expect(screen.getByText(/Showing 1 of 2 nodes/)).toBeTruthy();
  });

  it('filters by node ID text', () => {
    renderTable([makeRow(1), makeRow(2), makeRow(3)]);
    fireEvent.change(screen.getByLabelText('Filter node ID'), { target: { value: '0002' } });
    expect(bodyNodeIds()).toEqual(['!0002']);
  });

  it('paginates at 50 rows per page', () => {
    renderTable(Array.from({ length: 60 }, (_, i) => makeRow(i + 1)));
    expect(bodyNodeIds()).toHaveLength(50);
    expect(screen.getByText(/Page 1 of 2/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(bodyNodeIds()).toHaveLength(10);
    expect(screen.getByText(/Page 2 of 2/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(bodyNodeIds()).toHaveLength(50);
  });
});
