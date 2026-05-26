import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavMain } from './nav-main';
import { SidebarProvider } from '@/components/ui/sidebar';

vi.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: () => ({
    hasUnreadMessages: false,
    unreadMessages: [],
    markAllAsRead: vi.fn(),
    markAsReadForProtocol: vi.fn(),
    unreadCountForProtocol: () => 0,
    hasUnreadForProtocol: () => false,
  }),
}));

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getCurrentUser: () => ({ is_staff: false }),
  },
}));

vi.mock('@/hooks/api/useNodeWatches', () => ({
  useMeshInfraMonitoringAlertsSummary: () => ({ data: { mesh_infra: { alerting_nodes_count: 0 } } }),
}));

function renderNavAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider>
        <NavMain />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe('NavMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Meshtastic and MeshCore section labels', () => {
    renderNavAt('/');
    expect(screen.getAllByText('Meshtastic').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MeshCore').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps home Dashboard and Weather at top level', () => {
    renderNavAt('/');
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Weather')).toBeInTheDocument();
  });

  it('lists protocol dashboards under Meshtastic and MeshCore', () => {
    renderNavAt('/');
    const dashLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashLinks.some((el) => el.getAttribute('href') === '/meshtastic/dashboard')).toBe(true);
    expect(dashLinks.some((el) => el.getAttribute('href') === '/meshcore/dashboard')).toBe(true);
  });

  it('marks Messages active on /messages', () => {
    renderNavAt('/messages');
    const link = screen
      .getAllByRole('link', { name: /^Messages$/ })
      .find((el) => el.getAttribute('href') === '/messages');
    expect(link?.closest('[data-active="true"]')).toBeTruthy();
  });

  it('marks Meshtastic map child active on /map', () => {
    renderNavAt('/map');
    const link = screen.getAllByRole('link', { name: 'Map' }).find((el) => el.getAttribute('href') === '/map');
    expect(link?.closest('[data-active="true"]')).toBeTruthy();
  });

  it('marks MeshCore managed nodes child active on /meshcore/managed-nodes', () => {
    renderNavAt('/meshcore/managed-nodes');
    const links = screen.getAllByRole('link', { name: 'Managed nodes' });
    const meshcoreLink = links.find((el) => el.getAttribute('href') === '/meshcore/managed-nodes');
    expect(meshcoreLink?.closest('[data-active="true"]')).toBeTruthy();
  });

  it('does not show MeshCore Map nav link', () => {
    renderNavAt('/');
    const mapLinks = screen.queryAllByRole('link', { name: 'Map' });
    expect(mapLinks.some((el) => el.getAttribute('href') === '/meshcore/map')).toBe(false);
  });

  it('marks MeshCore Messages active on /meshcore/messages', () => {
    renderNavAt('/meshcore/messages');
    const links = screen.getAllByRole('link', { name: /^Messages$/ });
    const meshcoreLink = links.find((el) => el.getAttribute('href') === '/meshcore/messages');
    expect(meshcoreLink?.closest('[data-active="true"]')).toBeTruthy();
  });

  it('marks traceroute heat map active on /traceroutes/map/heat', () => {
    renderNavAt('/traceroutes/map/heat');
    const link = screen.getByRole('link', { name: 'Geographic' });
    expect(link.closest('[data-active="true"]')).toBeTruthy();
  });
});
