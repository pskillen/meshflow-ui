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
import { Link, useLocation } from 'react-router-dom';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { MessageProtocolSlug } from '@/lib/message-protocol';
import { authService } from '@/lib/auth/authService';
import { useMeshInfraMonitoringAlertsSummary } from '@/hooks/api/useNodeWatches';
import type { MeshInfraProtocol } from '@/lib/models';

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

type NavSection = {
  label?: string;
  items: NavItem[];
};

function isPathActive(pathname: string, url: string, exact: boolean) {
  if (exact) {
    return pathname === url;
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

function navSubItemActive(pathname: string, childUrl: string): boolean {
  switch (childUrl) {
    case '/meshtastic/dashboard':
      return pathname === '/meshtastic/dashboard';
    case '/meshcore/dashboard':
      return pathname === '/meshcore/dashboard';
    case '/meshcore/nodes':
      return pathname === '/meshcore/nodes' || pathname.startsWith('/meshcore/nodes/');
    case '/meshcore/managed-nodes':
      return pathname === '/meshcore/managed-nodes';
    case '/nodes':
      return pathname === '/nodes';
    case '/nodes/my-nodes':
      return pathname === '/nodes/my-nodes' || pathname.startsWith('/nodes/my-nodes/');
    case '/nodes/infrastructure':
      return pathname === '/nodes/infrastructure' || pathname.startsWith('/nodes/infrastructure/');
    case '/meshcore/infrastructure':
      return pathname === '/meshcore/infrastructure';
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

function buildNavSections(showDxMonitoring: boolean): NavSection[] {
  const meshtasticNodesChildren: NavChild[] = [
    { title: 'List', url: '/nodes', icon: ListIcon },
    { title: 'Managed nodes', url: '/nodes/managed-nodes', icon: ActivityIcon },
    { title: 'Watches', url: '/nodes/monitor', icon: ActivityIcon },
    ...(showDxMonitoring ? [{ title: 'DX monitoring', url: '/nodes/dx-monitoring', icon: ScanSearchIcon }] : []),
    { title: 'Mesh infra', url: '/nodes/infrastructure', icon: ServerIcon },
  ];

  return [
    {
      items: [
        { title: 'Dashboard', url: '/', icon: BarChartIcon },
        { title: 'Weather', url: '/weather', icon: CloudRainIcon },
        { title: 'My nodes', url: '/nodes/my-nodes', icon: RadioIcon },
      ],
    },
    {
      label: 'Meshtastic',
      items: [
        { title: 'Dashboard', url: '/meshtastic/dashboard', icon: BarChartIcon },
        { title: 'Messages', url: '/messages', icon: MessageSquareIcon },
        {
          title: 'Nodes',
          url: '/nodes',
          icon: NetworkIcon,
          children: meshtasticNodesChildren,
        },
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
      ],
    },
    {
      label: 'MeshCore',
      items: [
        { title: 'Dashboard', url: '/meshcore/dashboard', icon: BarChartIcon },
        {
          title: 'Passive path (preview)',
          url: '/meshcore/path-tracing',
          icon: RouteIcon,
        },
        { title: 'Messages', url: '/meshcore/messages', icon: MessageSquareIcon },
        {
          title: 'Nodes',
          url: '/meshcore/nodes',
          icon: NetworkIcon,
          children: [
            { title: 'List', url: '/meshcore/nodes', icon: ListIcon },
            { title: 'Managed nodes', url: '/meshcore/managed-nodes', icon: ActivityIcon },
            { title: 'Mesh infra', url: '/meshcore/infrastructure', icon: ServerIcon },
          ],
        },
      ],
    },
  ];
}

function messagesProtocolForUrl(url: string): MessageProtocolSlug | null {
  if (url === '/messages') return 'meshtastic';
  if (url === '/meshcore/messages') return 'meshcore';
  return null;
}

/** Nav child URLs that carry a Mesh infra alert badge, and the protocol each counts. */
const INFRA_BADGE_PROTOCOL_BY_URL: Record<string, MeshInfraProtocol> = {
  '/nodes/infrastructure': 'meshtastic',
  '/meshcore/infrastructure': 'meshcore',
};

function unreadBadgeLabel(count: number): string {
  if (count > 99) return '99+';
  return count > 9 ? '9+' : String(count);
}

function NavMenuItems({
  items,
  pathname,
  infraAlertCountForUrl,
  unreadCountForProtocol,
  hasUnreadForProtocol,
}: {
  items: NavItem[];
  pathname: string;
  /** Badge count for a nav child URL; 0 hides the badge. */
  infraAlertCountForUrl: (url: string) => number;
  unreadCountForProtocol: (protocol: MessageProtocolSlug) => number;
  hasUnreadForProtocol: (protocol: MessageProtocolSlug) => boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const parentActive = isPathActive(pathname, item.url, true);
        const messagesProtocol = messagesProtocolForUrl(item.url);

        return (
          <SidebarMenuItem key={`${item.title}-${item.url}`}>
            <SidebarMenuButton asChild tooltip={item.tooltip ?? item.title} isActive={parentActive}>
              {messagesProtocol ? (
                <Link to={item.url} className="relative">
                  <Icon />
                  <span>{item.title}</span>
                  {hasUnreadForProtocol(messagesProtocol) && (
                    <span
                      data-testid={`messages-unread-badge-${messagesProtocol}`}
                      className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white shadow-sm ring-2 ring-sidebar"
                    >
                      {unreadBadgeLabel(unreadCountForProtocol(messagesProtocol))}
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
                  const infraAlertCount = infraAlertCountForUrl(child.url);
                  return (
                    <SidebarMenuSubItem key={child.title}>
                      <SidebarMenuSubButton asChild isActive={childIsActive}>
                        <Link to={child.url} className={infraAlertCount > 0 ? 'relative pr-8' : undefined}>
                          <ChildIcon />
                          <span>{child.title}</span>
                          {infraAlertCount > 0 ? (
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
    </>
  );
}

export function NavMain() {
  const { unreadCountForProtocol, hasUnreadForProtocol } = useWebSocket();
  const { pathname } = useLocation();
  const currentUser = authService.getCurrentUser();
  const showDxMonitoring = Boolean(currentUser?.is_staff);
  const mtInfraAlerts = useMeshInfraMonitoringAlertsSummary('meshtastic', Boolean(currentUser));
  const mcInfraAlerts = useMeshInfraMonitoringAlertsSummary('meshcore', Boolean(currentUser));
  const infraAlertCountForUrl = (url: string): number => {
    const protocol = INFRA_BADGE_PROTOCOL_BY_URL[url];
    if (!protocol) return 0;
    const summary = (protocol === 'meshtastic' ? mtInfraAlerts : mcInfraAlerts).data?.mesh_infra;
    if (!summary) return 0;
    // Older APIs omit `supported`: Meshtastic was always monitored, MeshCore never.
    const supported = summary.supported ?? protocol === 'meshtastic';
    return supported ? (summary.alerting_nodes_count ?? 0) : 0;
  };

  const sections = buildNavSections(showDxMonitoring);

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {sections.map((section, index) => (
          <React.Fragment key={section.label ?? `top-${index}`}>
            {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
            <SidebarMenu>
              <NavMenuItems
                items={section.items}
                pathname={pathname}
                infraAlertCountForUrl={infraAlertCountForUrl}
                unreadCountForProtocol={unreadCountForProtocol}
                hasUnreadForProtocol={hasUnreadForProtocol}
              />
            </SidebarMenu>
          </React.Fragment>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
