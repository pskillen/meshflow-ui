import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ObservedNode } from '@/lib/models';
import { MESHCORE_CONFIG, MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';
import { NodesTable } from './NodesTable';

function node(id: number, name: string, extra: Record<string, unknown> = {}): ObservedNode {
  return {
    internal_id: `00000000-0000-4000-8000-${id.toString().padStart(12, '0')}`,
    node_id_str: `!${id.toString(16).padStart(8, '0')}`,
    long_name: `${name} long`,
    short_name: name,
    last_heard: new Date(Date.now() - id * 60_000),
    ...extra,
  } as unknown as ObservedNode;
}

function renderTable(nodes: ObservedNode[], config = MESHTASTIC_CONFIG) {
  return render(
    <MemoryRouter>
      <NodesTable nodes={nodes} config={config} />
    </MemoryRouter>
  );
}

const names = () => screen.getAllByTestId('node-row').map((r) => within(r).getAllByRole('link')[0]!.firstElementChild!.textContent);
const batt = (b: number | null) => ({ latest_device_metrics: b == null ? null : { battery_level: b } });

describe('NodesTable', () => {
  it('Meshtastic columns: node, ID, role, hardware, battery, last heard', () => {
    renderTable([node(1, 'Alpha', { meshtastic_role: 2, meshtastic_hw_model: 'TBEAM', ...batt(80) })]);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Node', 'ID', 'Role', 'Hardware', 'Battery', 'Last heard']);
    const row = screen.getByTestId('node-row');
    expect(within(row).getByText('TBEAM')).toBeInTheDocument();
    expect(within(row).getByText('80%')).toBeInTheDocument();
  });

  it('MeshCore columns: node, ID, prefix, position, last heard; position Known or None', () => {
    renderTable(
      [node(1, 'Pos', { latest_position: { latitude: 1, longitude: 2 }, mc_pubkey_prefix: 'ab' }), node(2, 'Nopos')],
      MESHCORE_CONFIG
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Node',
      'ID',
      'Prefix',
      'Position',
      'Last heard',
    ]);
    expect(screen.getByText('Known')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('battery 101 is Powered, 0 is 0%, no reading is a dash', () => {
    renderTable([node(1, 'Pow', batt(101)), node(2, 'Zero', batt(0)), node(3, 'None', batt(null))]);
    const rows = screen.getAllByTestId('node-row');
    expect(within(rows[0]!).getByText('Powered')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('0%')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText(/%|Powered/)).toBeNull();
    expect(screen.queryByText('101%')).toBeNull();
  });

  it('rows link to the node detail page', () => {
    renderTable([node(1, 'Alpha')]);
    const link = within(screen.getByTestId('node-row')).getAllByRole('link')[0]!;
    expect(link.getAttribute('href')).toBe(MESHTASTIC_CONFIG.routes.nodeDetail('00000000-0000-4000-8000-000000000001'));
  });

  it('starts by last heard, newest first; a header click sorts, a second click reverses', async () => {
    const user = userEvent.setup();
    renderTable([node(3, 'Cc'), node(1, 'Aa'), node(2, 'Bb')]);
    expect(names()).toEqual(['Aa', 'Bb', 'Cc']);
    expect(screen.getByRole('columnheader', { name: 'Last heard' })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Last heard' }));
    expect(names()).toEqual(['Cc', 'Bb', 'Aa']);
    await user.click(screen.getByRole('button', { name: 'Node' }));
    expect(names()).toEqual(['Aa', 'Bb', 'Cc']);
    expect(screen.getByRole('columnheader', { name: 'Node' })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Node' }));
    expect(names()).toEqual(['Cc', 'Bb', 'Aa']);
  });

  it('battery sort: Powered highest, a real 0 above no reading, no reading last either way', async () => {
    const user = userEvent.setup();
    renderTable([
      node(1, 'None', batt(null)),
      node(2, 'Zero', batt(0)),
      node(3, 'Pow', batt(101)),
      node(4, 'Mid', batt(50)),
    ]);
    await user.click(screen.getByRole('button', { name: 'Battery' }));
    expect(names()).toEqual(['Pow', 'Mid', 'Zero', 'None']);
    await user.click(screen.getByRole('button', { name: 'Battery' }));
    expect(names()).toEqual(['Zero', 'Mid', 'Pow', 'None']);
  });

  it('shows an empty message when there are no nodes', () => {
    renderTable([]);
    expect(screen.getByText('No nodes in this range.')).toBeInTheDocument();
  });
});

