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

  // Each case: a fixture of three present values in ascending order plus one missing, named by its label.
  // Ascending order is the order of `asc`; the missing node ("Miss") is last in both directions.
  const pos = { latest_position: { latitude: 1, longitude: 2 } };
  const ago = (min: number) => ({ last_heard: new Date(Date.now() - min * 60_000) });
  const cases: {
    protocol: 'meshtastic' | 'meshcore';
    header: string;
    nodes: ObservedNode[];
    asc: string[];
    desc: string[];
  }[] = [
    {
      protocol: 'meshtastic',
      header: 'Node',
      nodes: [node(1, 'Bb'), node(2, 'Cc'), node(3, 'Aa'), node(4, 'Miss', { short_name: '', long_name: '' })],
      asc: ['Aa', 'Bb', 'Cc', '!00000004'],
      desc: ['Cc', 'Bb', 'Aa', '!00000004'],
    },
    {
      protocol: 'meshtastic',
      header: 'ID',
      nodes: [node(2, 'Bb'), node(3, 'Cc'), node(1, 'Aa'), node(4, 'Miss', { node_id_str: '' })],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
    {
      protocol: 'meshtastic',
      header: 'Role',
      nodes: [
        node(1, 'Bb', { meshtastic_role: 4 }),
        node(2, 'Cc', { meshtastic_role: 5 }),
        node(3, 'Aa', { meshtastic_role: 0 }),
        node(4, 'Miss'),
      ],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
    {
      protocol: 'meshtastic',
      header: 'Hardware',
      nodes: [
        node(1, 'Bb', { meshtastic_hw_model: 'B' }),
        node(2, 'Cc', { meshtastic_hw_model: 'C' }),
        node(3, 'Aa', { meshtastic_hw_model: 'A' }),
        node(4, 'Miss'),
      ],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
    {
      protocol: 'meshtastic',
      header: 'Battery',
      nodes: [node(1, 'Bb', batt(50)), node(2, 'Cc', batt(101)), node(3, 'Aa', batt(10)), node(4, 'Miss', batt(null))],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
    {
      protocol: 'meshtastic',
      header: 'Last heard',
      nodes: [
        node(1, 'Bb', ago(20)),
        node(2, 'Cc', ago(5)),
        node(3, 'Aa', ago(60)),
        node(4, 'Miss', { last_heard: null }),
      ],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
    {
      protocol: 'meshcore',
      header: 'Prefix',
      nodes: [
        node(1, 'Bb', { mc_pubkey_prefix: 'b' }),
        node(2, 'Cc', { mc_pubkey_prefix: 'c' }),
        node(3, 'Aa', { mc_pubkey_prefix: 'a' }),
        node(4, 'Miss'),
      ],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
    {
      // Position "None" is missing: last both ways. Ties keep their order.
      protocol: 'meshcore',
      header: 'Position',
      nodes: [node(1, 'Known1', pos), node(2, 'None1'), node(3, 'Known2', pos), node(4, 'None2')],
      asc: ['Known1', 'Known2', 'None1', 'None2'],
      desc: ['Known1', 'Known2', 'None1', 'None2'],
    },
    {
      protocol: 'meshcore',
      header: 'Last heard',
      nodes: [
        node(1, 'Bb', ago(20)),
        node(2, 'Cc', ago(5)),
        node(3, 'Aa', ago(60)),
        node(4, 'Miss', { last_heard: null }),
      ],
      asc: ['Aa', 'Bb', 'Cc', 'Miss'],
      desc: ['Cc', 'Bb', 'Aa', 'Miss'],
    },
  ];

  it.each(cases)('$protocol $header sort: ascending, descending, missing last', async (c) => {
    const user = userEvent.setup();
    renderTable(c.nodes, c.protocol === 'meshcore' ? MESHCORE_CONFIG : MESHTASTIC_CONFIG);
    const button = screen.getByRole('button', { name: c.header });
    const header = screen.getByRole('columnheader', { name: c.header });
    // Last heard starts newest first (descending); every other column starts at its first-click direction.
    await user.click(button);
    const first = header.getAttribute('aria-sort');
    const firstOrder = names();
    await user.click(button);
    const secondOrder = names();
    const [ascOrder, descOrder] = first === 'ascending' ? [firstOrder, secondOrder] : [secondOrder, firstOrder];
    expect(ascOrder).toEqual(c.asc);
    expect(descOrder).toEqual(c.desc);
  });

  it('sorts from the keyboard: Enter and Space on a header button', async () => {
    const user = userEvent.setup();
    renderTable([node(3, 'Cc'), node(1, 'Aa'), node(2, 'Bb')]);
    const button = screen.getByRole('button', { name: 'Node' });
    await user.tab();
    while (document.activeElement !== button) await user.tab();
    await user.keyboard('{Enter}');
    expect(names()).toEqual(['Aa', 'Bb', 'Cc']);
    expect(button).toHaveFocus();
    await user.keyboard(' ');
    expect(names()).toEqual(['Cc', 'Bb', 'Aa']);
    expect(screen.getByRole('columnheader', { name: 'Node' })).toHaveAttribute('aria-sort', 'descending');
  });

  it('names the table for assistive tech', () => {
    render(
      <MemoryRouter>
        <NodesTable nodes={[node(1, 'Aa')]} config={MESHTASTIC_CONFIG} aria-label="Recent nodes" />
      </MemoryRouter>
    );
    expect(screen.getByRole('table', { name: 'Recent nodes' })).toBeInTheDocument();
  });

  it('shows Last heard compactly', () => {
    renderTable([node(14, 'Aa'), node(300, 'Bb'), node(4320, 'Cc')]);
    expect(screen.getByText('14m ago')).toBeInTheDocument();
    expect(screen.getByText('5h ago')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });

  it('shows a custom empty message', () => {
    render(
      <MemoryRouter>
        <NodesTable nodes={[]} config={MESHTASTIC_CONFIG} emptyMessage="No nodes match your search" />
      </MemoryRouter>
    );
    expect(screen.getByText('No nodes match your search')).toBeInTheDocument();
  });

  it('shows an empty message when there are no nodes', () => {
    renderTable([]);
    expect(screen.getByText('No nodes in this range.')).toBeInTheDocument();
  });
});

