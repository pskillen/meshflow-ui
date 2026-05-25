import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtocolBadge } from './ProtocolBadge';

describe('ProtocolBadge', () => {
  it('shows MeshCore for protocol 2', () => {
    render(<ProtocolBadge node={{ protocol: 2, node_id_str: 'mc:aabb' }} />);
    expect(screen.getByText('MeshCore')).toBeInTheDocument();
  });

  it('shows Meshtastic for protocol 1', () => {
    render(<ProtocolBadge node={{ protocol: 1, node_id_str: '!12345678' }} />);
    expect(screen.getByText('Meshtastic')).toBeInTheDocument();
  });
});
