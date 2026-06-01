import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MeshCoreHeardPathFlow } from './MeshCoreHeardPathFlow';
import type { MeshCoreHeardLeg } from './heard-path-map-adapters';

const baseLeg: MeshCoreHeardLeg = {
  observation: {
    observer: {
      node_id_str: 'mc:feed',
      internal_id: null,
      long_name: 'Feeder',
      short_name: 'F',
      position: { latitude: 55.2, longitude: -4.2 },
    },
    rx_time: new Date().toISOString(),
    rx_rssi: -90,
    rx_snr: 2,
    path_hashes: ['aa', 'bb'],
    resolved_path: [
      {
        hash: 'aa',
        status: 'unknown',
        node_id_str: null,
        internal_id: null,
        long_name: null,
        ambiguous: false,
      },
      {
        hash: 'bb',
        status: 'unknown',
        node_id_str: null,
        internal_id: null,
        long_name: null,
        ambiguous: false,
      },
    ],
    path_known: false,
  },
  receiverLabel: 'F',
  receiverPosition: { latitude: 55.2, longitude: -4.2 },
  hops: [
    {
      hash: 'aa',
      status: 'unknown',
      node_id_str: null,
      internal_id: null,
      long_name: null,
      ambiguous: false,
    },
    {
      hash: 'bb',
      status: 'unknown',
      node_id_str: null,
      internal_id: null,
      long_name: null,
      ambiguous: false,
    },
  ],
  pathKnown: false,
  lineColor: '#2563eb',
};

function renderFlow(leg: MeshCoreHeardLeg, senderKnown: boolean) {
  return render(
    <MemoryRouter>
      <MeshCoreHeardPathFlow leg={leg} senderDisplayLabel="Sender" senderKnown={senderKnown} />
    </MemoryRouter>
  );
}

describe('MeshCoreHeardPathFlow', () => {
  it('renders one hop badge per segment', () => {
    renderFlow(baseLeg, true);
    expect(screen.getByText('aa')).toBeInTheDocument();
    expect(screen.getByText('bb')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows empty path message when no hops', () => {
    const leg = { ...baseLeg, hops: [] };
    renderFlow(leg, true);
    expect(screen.getByText(/No path recorded for this observation/i)).toBeInTheDocument();
  });

  it('shows sender unknown label when sender not known', () => {
    renderFlow(baseLeg, false);
    expect(screen.getByText(/Sender unknown/i)).toBeInTheDocument();
  });
});
