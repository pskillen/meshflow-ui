import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ObservedNode } from '@/lib/models';
import { NodeMeshMonitoringSection } from './NodeMeshMonitoringSection';

vi.mock('@/lib/auth/authService', () => ({ authService: { getCurrentUser: () => ({ id: 1 }) } }));
vi.mock('@/hooks/api/useNodeWatches', () => ({
  useNodeWatches: () => ({ data: { results: [] }, isLoading: false }),
  useNodeMonitoringConfig: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('@/components/nodes/MeshWatchControls', () => ({ MeshWatchControls: () => null }));
vi.mock('@/components/nodes/NodeMeshMonitoringSettingsDialog', () => ({
  NodeMeshMonitoringSettingsDialog: () => null,
}));

const base = { internal_id: 'a', protocol: 1, meshtastic_node_id: 1, node_id_str: '!00000001' } as ObservedNode;

const renderSection = (node: ObservedNode) =>
  render(
    <MemoryRouter>
      <NodeMeshMonitoringSection node={node} />
    </MemoryRouter>
  );

describe('NodeMeshMonitoringSection replaced note', () => {
  it('notes the pause and links the new number when replaced_by is set', () => {
    renderSection({
      ...base,
      replaced_by: { internal_id: 'b', protocol: 1, meshtastic_node_id: 2, node_id_str: '!00000002' },
    });
    expect(screen.getByTestId('monitoring-replaced-note')).toHaveTextContent(
      'Paused: this radio now uses node !00000002. Offline alerts for this number are paused.'
    );
    expect(screen.getByRole('link', { name: '!00000002' })).toHaveAttribute('href', '/nodes/!00000002');
  });

  it('shows no note without replaced_by', () => {
    renderSection({ ...base, replaced_by: null });
    expect(screen.queryByTestId('monitoring-replaced-note')).not.toBeInTheDocument();
  });
});
