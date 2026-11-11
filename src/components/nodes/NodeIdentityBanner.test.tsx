import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { NodeIdentityChainEntry, ObservedNode } from '@/lib/models';
import { parseObservedNodeFromAPI } from '@/lib/api/api-utils';
import { NodeIdentityBanner } from './NodeIdentityBanner';

const entry = (over: Partial<NodeIdentityChainEntry> = {}): NodeIdentityChainEntry => ({
  internal_id: '6f1c0000-0000-4000-8000-000000000001',
  protocol: 1,
  meshtastic_node_id: 2304338203,
  node_id_str: '!8959691b',
  long_name: 'PDYt Paper',
  short_name: 'PDYt',
  last_heard: new Date(Date.now() - 5 * 60 * 1000),
  evidence: 'feeder_rekey',
  confidence: 'strong',
  state: 'auto',
  linked_at: new Date('2026-11-10T22:50:08Z'),
  ...over,
});

const node = (over: Partial<ObservedNode> = {}): ObservedNode =>
  ({
    internal_id: 'a',
    protocol: 1,
    meshtastic_node_id: 1127609074,
    node_id_str: '!433b82f2',
    ...over,
  }) as ObservedNode;

const renderBanner = (n: ObservedNode, compact = false) =>
  render(
    <MemoryRouter>
      <NodeIdentityBanner node={n} compact={compact} />
    </MemoryRouter>
  );

const replacedNode = (chain: Partial<NonNullable<ObservedNode['identity_chain']>> = {}) =>
  node({
    replaced_by: { internal_id: 'b', protocol: 1, meshtastic_node_id: 2304338203, node_id_str: '!8959691b' },
    identity_chain: { previous: [], next: [entry()], ...chain },
  });

describe('NodeIdentityBanner', () => {
  it('renders nothing when the fields are missing (older api)', () => {
    const { container } = renderBanner(node());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both lists are empty', () => {
    const { container } = renderBanner(node({ replaced_by: null, identity_chain: { previous: [], next: [] } }));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows one previous number as a quiet line', () => {
    renderBanner(
      node({ identity_chain: { previous: [entry({ node_id_str: '!433b82f0', evidence: 'public_key' })], next: [] } })
    );
    const line = screen.getByTestId('node-identity-previous');
    expect(line).toHaveTextContent('Previously node !433b82f0. Older history is on that page.');
    expect(within(line).getByRole('link', { name: '!433b82f0' })).toHaveAttribute('href', '/nodes/!433b82f0');
    expect(screen.queryByTestId('node-identity-replaced')).not.toBeInTheDocument();
  });

  it('lists the other previous numbers behind "and N more"', async () => {
    const previous = [
      entry({ node_id_str: '!00000003', internal_id: 'p3' }),
      entry({ node_id_str: '!00000002', internal_id: 'p2' }),
      entry({ node_id_str: '!00000001', internal_id: 'p1' }),
    ];
    renderBanner(node({ identity_chain: { previous, next: [] } }));
    expect(screen.queryByTestId('node-identity-previous-list')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'and 2 more' }));
    const list = screen.getByTestId('node-identity-previous-list');
    expect(within(list).getByRole('link', { name: '!00000002' })).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: '!00000001' })).toBeInTheDocument();
  });

  it('shouts when the node is replaced', () => {
    renderBanner(replacedNode());
    const box = screen.getByTestId('node-identity-replaced');
    expect(box).toHaveTextContent('This radio now uses node !8959691b (PDYt Paper). Heard 5 minutes ago.');
    expect(box).toHaveTextContent('History up to 10 Nov 2026 is on this page; newer history is on the new one.');
    expect(screen.getByRole('link', { name: 'Go to !8959691b' })).toHaveAttribute('href', '/nodes/!8959691b');
  });

  it('whispers when there is a successor but the node is not replaced (radio went back)', () => {
    renderBanner(
      node({
        replaced_by: null,
        identity_chain: {
          previous: [],
          next: [entry({ last_heard: new Date('2026-11-10T23:00:00Z'), linked_at: new Date('2026-11-10T22:50:08Z') })],
        },
      })
    );
    expect(screen.queryByTestId('node-identity-replaced')).not.toBeInTheDocument();
    expect(screen.getByTestId('node-identity-successor')).toHaveTextContent(
      'This radio also used node !8959691b from 10 Nov 2026 to 10 Nov 2026.'
    );
  });

  it('names the last entry of a chain in the banner', () => {
    const next = [
      entry({ node_id_str: '!00000002', internal_id: 'n2', long_name: 'Second' }),
      entry({ node_id_str: '!00000003', internal_id: 'n3', long_name: 'Third' }),
    ];
    renderBanner(
      node({
        replaced_by: { internal_id: 'n3', protocol: 1, meshtastic_node_id: 3, node_id_str: '!00000003' },
        identity_chain: { previous: [], next },
      })
    );
    expect(screen.getByTestId('node-identity-replaced')).toHaveTextContent('node !00000003 (Third)');
  });

  it('shows the banner and the previous line together for a middle node', () => {
    renderBanner(replacedNode({ previous: [entry({ node_id_str: '!433b82f0', internal_id: 'p' })] }));
    expect(screen.getByTestId('node-identity-replaced')).toBeInTheDocument();
    expect(screen.getByTestId('node-identity-previous')).toHaveTextContent('Previously node !433b82f0');
  });

  it('links MeshCore ids using the protocol-aware path', () => {
    renderBanner(
      node({
        protocol: 2,
        replaced_by: { internal_id: 'm2', protocol: 2, meshtastic_node_id: null, node_id_str: 'mc:aabbccddeeff' },
        identity_chain: {
          previous: [],
          next: [
            entry({ protocol: 2, meshtastic_node_id: null, node_id_str: 'mc:aabbccddeeff', evidence: 'public_key' }),
          ],
        },
      })
    );
    expect(screen.getByRole('link', { name: 'Go to mc:aabbccddeeff' })).toHaveAttribute(
      'href',
      '/nodes/mc%3Aaabbccddeeff'
    );
  });

  it('compact shows one line with no disclosure', () => {
    renderBanner(replacedNode({ previous: [entry({ node_id_str: '!433b82f0', internal_id: 'p' })] }), true);
    expect(screen.getByTestId('node-identity-replaced')).toHaveTextContent('This radio now uses node !8959691b');
    expect(screen.queryByTestId('node-identity-previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Why?')).not.toBeInTheDocument();
    expect(screen.queryByText(/History up to/)).not.toBeInTheDocument();
  });

  it.each([
    ['public_key', 'auto', 'Same public key.'],
    ['feeder_rekey', 'auto', 'The feeder reported the change.'],
    ['predicted_number', 'auto', "The new number was predicted from this node's public key."],
    ['mac', 'auto', 'Same hardware address.'],
    ['declared', 'confirmed', 'The owner said so.'],
    ['public_key', 'confirmed', 'Same public key, confirmed by staff.'],
    ['something_new', 'auto', 'Linked by Meshflow.'],
  ])('explains %s (%s) in plain words', (evidence, state, text) => {
    renderBanner(replacedNode({ next: [entry({ evidence, state })] }));
    expect(screen.getByText('Why?').parentElement).toHaveTextContent(text);
  });

  it('parses entry dates from the api payload and keeps absent fields absent', () => {
    const parsed = parseObservedNodeFromAPI({
      ...node(),
      identity_chain: {
        previous: [],
        next: [{ ...entry(), last_heard: '2026-11-11T09:12:00Z', linked_at: '2026-11-10T22:50:08Z' }],
      },
    } as unknown as ObservedNode);
    expect(parsed.identity_chain?.next[0].last_heard).toBeInstanceOf(Date);
    expect(parsed.identity_chain?.next[0].linked_at).toBeInstanceOf(Date);
    expect('identity_chain' in parseObservedNodeFromAPI(node())).toBe(false);
  });
});
