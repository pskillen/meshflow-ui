import * as React from 'react';
import {
  ActivityIcon,
  BarChartIcon,
  CircleDashedIcon,
  CloudRainIcon,
  MapIcon,
  MessageSquareIcon,
  NetworkIcon,
  RadioIcon,
  RouteIcon,
  ListIcon,
  ScanSearchIcon,
  ServerIcon,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { authService } from '@/lib/auth/authService';
import { useMeshInfraMonitoringAlertsSummary } from '@/hooks/api/useNodeWatches';

type NavChild = {
  title: string;
  url: string;
  icon: LucideIcon;
};

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  tooltip?: string;
  children?: NavChild[];
};

function isPathActive(pathname: string, url: string, exact: boolean) {
  if (exact) {
    return pathname === url;
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

function navSubItemActive(pathname: string, childUrl: string): boolean {
  switch (childUrl) {
    case '/traceroutes/history':
      return pathname === '/traceroutes/history' || pathname.startsWith('/traceroutes/history/');
    case '/traceroutes/map/heat':
      return pathname === '/traceroutes/map/heat' || pathname === '/traceroutes/map/snr';
    case '/traceroutes/map/topology/heat':
      return pathname.startsWith('/traceroutes/map/topology');
    case '/traceroutes/map/coverage':
      return pathname === '/traceroutes/map/coverage';
    case '/traceroutes/map/coverage/constellation':
      return pathname.startsWith('/traceroutes/map/coverage/constellation');
    default:
      return pathname === childUrl || pathname.startsWith(`${childUrl}/`);
  }
}

export function NavMain() {
  const { hasUnreadMessages, unreadMessages, markAllAsRead } = useWebSocket();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentUser = authService.getCurrentUser();
  const showDxMonitoring = Boolean(currentUser?.is_staff);
  const infraAlerts = useMeshInfraMonitoringAlertsSummary(Boolean(currentUser));
  const infraAlertCount = infraAlerts.data?.mesh_infra.alerting_nodes_count ?? 0;

  const handleMessagesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    markAllAsRead();
    navigate('/messages');
  };

  const items: NavItem[] = [
    { title: 'Dashboard', url: '/', icon: BarChartIcon },
    { title: 'Messages', url: '/messages', icon: MessageSquareIcon },
    {
      title: 'Nodes',
      url: '/nodes',
      icon: NetworkIcon,
      children: [
        { title: 'My nodes', url: '/nodes/my-nodes', icon: RadioIcon },
        { title: 'Managed nodes', url: '/nodes/managed-nodes', icon: ActivityIcon },
        { title: 'Watches', url: '/nodes/monitor', icon: ActivityIcon },
        ...(showDxMonitoring ? [{ title: 'DX monitoring', url: '/nodes/dx-monitoring', icon: ScanSearchIcon }] : []),
        { title: 'Mesh infra', url: '/nodes/infrastructure', icon: ServerIcon },
      ],
    },
    {
      title: 'MeshCore',
      url: '/meshcore/map',
      icon: RadioIcon,
      children: [
        { title: 'Map', url: '/meshcore/map', icon: MapIcon },
        { title: 'Nodes', url: '/meshcore/nodes', icon: ListIcon },
      ],
    },
    { title: 'Weather', url: '/weather', icon: CloudRainIcon },
    {
      title: 'Traceroutes',
      url: '/traceroutes',
      icon: RouteIcon,
      children: [
        { title: 'History', url: '/traceroutes/history', icon: ListIcon },
        { title: 'Geographic', url: '/traceroutes/map/heat', icon: MapIcon },
        { title: 'Topology', url: '/traceroutes/map/topology/heat', icon: Share2 },
        { title: 'Coverage by node', url: '/traceroutes/map/coverage', icon: CircleDashedIcon },
        {
          title: 'Constellation coverage',
          url: '/traceroutes/map/coverage/constellation',
          icon: CircleDashedIcon,
        },
      ],
    },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            // Parent should only be highlighted when its own page is active, not when a child is active.
            const parentActive = isPathActive(pathname, item.url, true);
            const isMessages = item.title === 'Messages';

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.tooltip ?? item.title} isActive={parentActive}>
                  {isMessages ? (
                    <Link to={item.url} className="relative" onClick={handleMessagesClick}>
                      <Icon />
                      <span>{item.title}</span>
                      {hasUnreadMessages && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 p-0 text-xs text-white shadow-sm ring-2 ring-sidebar">
                          {unreadMessages.length > 9 ? '9+' : unreadMessages.length}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <Link to={item.url}>
                      <Icon />
                      <span>{item.title}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
                {item.children && item.children.length > 0 && (
                  <SidebarMenuSub>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childIsActive = navSubItemActive(pathname, child.url);
                      const isMeshInfra = child.title === 'Mesh infra';
                      return (
                        <SidebarMenuSubItem key={child.title}>
                          <SidebarMenuSubButton asChild isActive={childIsActive}>
                            <Link
                              to={child.url}
                              className={isMeshInfra && infraAlertCount > 0 ? 'relative pr-8' : undefined}
                            >
                              <ChildIcon />
                              <span>{child.title}</span>
                              {isMeshInfra && infraAlertCount > 0 ? (
                                <span
                                  className="absolute right-1 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold leading-none text-white shadow-sm"
                                  title="Mesh infrastructure monitoring alerts"
                                >
                                  {infraAlertCount > 99 ? '99+' : infraAlertCount}
                                </span>
                              ) : null}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
