import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PacketObservation, TextMessage } from '@/lib/models';
import { MessageItem } from './MessageItem';

vi.mock('@/components/messages/HeardPathMap', () => ({ HeardPathMap: () => null }));
vi.mock('@/components/messages/HeardPathGeoMap', () => ({ HeardPathGeoMap: () => null }));

function obs(over: Partial<PacketObservation>, id: number): PacketObservation {
  return {
    observer: { meshtastic_node_id: id, node_id_str: `!${id}`, long_name: null, short_name: `O${id}` },
    rx_time: '2026-01-01T00:00:00Z',
    rx_rssi: null,
    rx_snr: null,
    direct_from_sender: false,
    hop_count: null,
    ...over,
  };
}

async function openDialog(heard: PacketObservation[]) {
  const message = {
    id: 'm1',
    sent_at: '2026-01-01T00:00:00Z',
    message_text: 'hi',
    heard,
  } as unknown as TextMessage;
  render(
    <MemoryRouter>
      <MessageItem message={message} />
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole('button', { name: /message heard by/i }));
}

describe('MessageItem heard dialog hop labels', () => {
  it('shows "Hops unknown" instead of an empty "Hop: "', async () => {
    await openDialog([obs({ hop_count: null }, 1), obs({ hop_count: 2 }, 2)]);
    expect(screen.getByText('Hops unknown')).toBeInTheDocument();
    expect(screen.getByText('Hops: 2')).toBeInTheDocument();
    expect(screen.queryByText(/^Hop: ?$/)).not.toBeInTheDocument();
  });

  it('shows "Via internet" for an MQTT observation', async () => {
    await openDialog([obs({ via_mqtt: true, transport_mechanism: 'TRANSPORT_MQTT' }, 3)]);
    expect(screen.getByText('Via internet')).toBeInTheDocument();
  });

  it('makes the label keyboard focusable', async () => {
    await openDialog([obs({}, 4)]);
    expect(screen.getByText('Hops unknown')).toHaveAttribute('tabindex', '0');
  });
});
